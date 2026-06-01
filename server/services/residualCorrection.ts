import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { appConfig, assertDateInput, isDbConfigured } from '../config.js'
import {
  getPredictionsByDateRange,
  getResidualCorrectionsByDateRange,
  saveResidualCorrections,
  type ResidualCorrectionRow,
} from '../db/repositories.js'
import type { AutomationPredictionRow } from './mlbAutomation.js'
import type { ScheduleRow } from '../../src/lib/mlbTypes.js'

export type ResidualDelta = {
  lookupKey: string
  deltaHome: number
  deltaAway: number
}

export type ModelMetadata = {
  modelVersion: string
  trainingFromDate: string
  trainingToDate: string
  trainingRowCount: number
  heldOutMAE_home: number
  heldOutMAE_away: number
  analyticalBaselineMAE_home: number
  analyticalBaselineMAE_away: number
  features: string[]
}

const MAX_DELTA = 3.0
const EARLY_SEASON_CUTOFF_MONTH = 5  // suppress correction through April 30 (month < 5)
const EARLY_SEASON_CUTOFF_DAY = 15    // and through May 15

export type ApplyCorrectionsResult = {
  date: string
  mode: string
  corrected: number
  skipped: number
  modelVersion: string | null
}

export async function applyResidualCorrections(dateInput?: string): Promise<ApplyCorrectionsResult> {
  const date = assertDateInput(dateInput)

  if (!appConfig.enableResidualCorrection) {
    return { date, mode: 'disabled', corrected: 0, skipped: 0, modelVersion: null }
  }

  if (!isDbConfigured()) {
    throw new Error('apply-residual-corrections requires DATABASE_URL and ENABLE_DB_PERSISTENCE=true.')
  }

  // Season rollover guard: suppress through May 15 to avoid cross-season artifact mismatch
  if (isEarlySeasonSuppressed(date)) {
    console.warn(`[residualCorrection] Early-season suppression active for ${date} — skipping residual correction.`)
    return { date, mode: 'early-season-suppressed', corrected: 0, skipped: 0, modelVersion: null }
  }

  const metadata = await loadModelMetadata()
  if (!metadata) {
    console.warn('[residualCorrection] model artifact not found — falling back to analytical projection.')
    return { date, mode: 'no-artifact', corrected: 0, skipped: 0, modelVersion: null }
  }

  // Stale artifact guard: artifact trained on prior season data
  if (isArtifactStale(metadata, date)) {
    console.warn(`[residualCorrection] Model artifact (trainingFromDate=${metadata.trainingFromDate}) is from a prior season — falling back.`)
    return { date, mode: 'stale-artifact', corrected: 0, skipped: 0, modelVersion: metadata.modelVersion }
  }

  const predictionRecords = await getPredictionsByDateRange(date, date)
  if (predictionRecords.length === 0) {
    return { date, mode: 'no-predictions', corrected: 0, skipped: 0, modelVersion: metadata.modelVersion }
  }

  const games = predictionRecords.map((record) => {
    const payload = record.payload as unknown as AutomationPredictionRow
    return {
      lookupKey: record.lookupKey,
      features: buildFeatureVector(payload, metadata.features),
    }
  })

  let deltas: ResidualDelta[]
  try {
    deltas = await runPredictScript(games, appConfig.residualModelDir)
  } catch (error) {
    console.warn(`[residualCorrection] predict_residual.py failed — falling back to analytical projection. Error: ${error instanceof Error ? error.message : error}`)
    return { date, mode: 'script-error', corrected: 0, skipped: predictionRecords.length, modelVersion: metadata.modelVersion }
  }

  const deltaByKey = new Map(deltas.map((d) => [d.lookupKey, d]))

  const correctionRows: ResidualCorrectionRow[] = []
  for (const record of predictionRecords) {
    const payload = record.payload as unknown as AutomationPredictionRow
    const delta = deltaByKey.get(record.lookupKey)
    if (!delta) continue

    const clampedDeltaHome = clamp(delta.deltaHome, -MAX_DELTA, MAX_DELTA)
    const clampedDeltaAway = clamp(delta.deltaAway, -MAX_DELTA, MAX_DELTA)

    correctionRows.push({
      lookupKey: record.lookupKey,
      predictionRunId: record.predictionRunId,
      deltaHome: clampedDeltaHome,
      deltaAway: clampedDeltaAway,
      correctedHome: Math.max(0, payload.homeRuns + clampedDeltaHome),
      correctedAway: Math.max(0, payload.awayRuns + clampedDeltaAway),
      modelVersion: metadata.modelVersion,
    })
  }

  const saved = await saveResidualCorrections(date, correctionRows)
  const skipped = predictionRecords.length - correctionRows.length

  console.log(`[residualCorrection] ${saved} corrections saved for ${date} (model: ${metadata.modelVersion})`)

  return {
    date,
    mode: 'applied',
    corrected: saved,
    skipped,
    modelVersion: metadata.modelVersion,
  }
}

export async function evaluateResidual(dateRange: { from: string; to: string }) {
  if (!isDbConfigured()) {
    throw new Error('evaluate-residual requires DATABASE_URL and ENABLE_DB_PERSISTENCE=true.')
  }

  const from = assertDateInput(dateRange.from)
  const to = assertDateInput(dateRange.to, from)

  const [predictionRecords, correctionRecords] = await Promise.all([
    getPredictionsByDateRange(from, to),
    getResidualCorrectionsByDateRange(from, to),
  ])

  const correctionByKey = new Map(correctionRecords.map((c) => [c.lookupKey, c]))

  const matched: Array<{
    lookupKey: string
    projectedHome: number
    projectedAway: number
    correctedHome: number
    correctedAway: number
  }> = []

  for (const pred of predictionRecords) {
    const payload = pred.payload as unknown as AutomationPredictionRow
    const correction = correctionByKey.get(pred.lookupKey)
    if (!correction) continue
    matched.push({
      lookupKey: pred.lookupKey,
      projectedHome: payload.homeRuns,
      projectedAway: payload.awayRuns,
      correctedHome: correction.correctedHome,
      correctedAway: correction.correctedAway,
    })
  }

  return {
    from,
    to,
    totalPredictions: predictionRecords.length,
    totalCorrections: correctionRecords.length,
    matched: matched.length,
    unmatched: predictionRecords.length - matched.length,
    note: matched.length === 0
      ? 'No corrections available for this window. Run apply-residual-corrections first, then ingest results to compare.'
      : 'Use scripts/evaluate_residual_model.py for full MAE and Brier score comparison against actuals.',
    corrections: matched,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}

function isEarlySeasonSuppressed(date: string): boolean {
  const [, monthStr, dayStr] = date.split('-')
  const month = Number(monthStr)
  const day = Number(dayStr)
  // Suppress April entirely and through May 15
  if (month < 4) return false  // offseason / spring training — no suppression needed
  if (month === 4) return true
  if (month === EARLY_SEASON_CUTOFF_MONTH && day <= EARLY_SEASON_CUTOFF_DAY) return true
  return false
}

function isArtifactStale(metadata: ModelMetadata, date: string): boolean {
  const trainingYear = Number(metadata.trainingFromDate.slice(0, 4))
  const currentYear = Number(date.slice(0, 4))
  return trainingYear < currentYear
}

async function loadModelMetadata(): Promise<ModelMetadata | null> {
  const metaPath = path.resolve(appConfig.residualModelDir, 'model_metadata.json')
  try {
    const raw = await readFile(metaPath, 'utf-8')
    return JSON.parse(raw) as ModelMetadata
  } catch {
    return null
  }
}

function buildFeatureVector(payload: AutomationPredictionRow, featureNames: string[]): Record<string, number | string | null> {
  const all: Record<string, number | string | null> = {
    ProjectedHomeRuns: payload.homeRuns,
    ProjectedAwayRuns: payload.awayRuns,
    MarketTotal: payload.marketTotal,
    HomeLineupConfidence: payload.homeLineupConfidence,
    AwayLineupConfidence: payload.awayLineupConfidence,
    // Remaining features (starter stats, weather) populated from payload when available
    // Extended fields added as AutomationPredictionRow grows
  }
  // Return only the features the model was trained on
  return Object.fromEntries(featureNames.map((f) => [f, all[f] ?? null]))
}

function runPredictScript(
  games: Array<{ lookupKey: string; features: Record<string, number | string | null> }>,
  modelDir: string,
): Promise<ResidualDelta[]> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ modelDir: path.resolve(modelDir), games })
    const child = spawn('python3', ['scripts/predict_residual.py'], { stdio: ['pipe', 'pipe', 'pipe'] })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`predict_residual.py exited with code ${code}. stderr: ${stderr.trim()}`))
        return
      }
      try {
        resolve(JSON.parse(stdout) as ResidualDelta[])
      } catch {
        reject(new Error(`Failed to parse predict_residual.py output: ${stdout.slice(0, 200)}`))
      }
    })

    child.on('error', (err) => reject(err))
    child.stdin.write(payload)
    child.stdin.end()
  })
}
