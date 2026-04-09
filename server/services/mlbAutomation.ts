import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { analyzeBetting } from '../../src/lib/betting.js'
import { buildCompositeRecommendation } from '../../src/lib/compositeRecommendation.js'
import { fetchCompletedGameResults, fetchLiveScheduleRows, fetchTeamRatings } from '../../src/lib/mlbApi.js'
import { predictGame } from '../../src/lib/mlbModel.js'
import { DEFAULT_THRESHOLDS, evaluatePredictions, type ParsedPredictionRow, type ParsedResultRow } from '../../src/lib/modelEvaluation.js'
import type { LineupConfidence, ScheduleRow, TeamAbbr } from '../../src/lib/mlbTypes.js'
import { appConfig, assertDateInput, isDbConfigured, subtractOneDay } from '../config.js'
import {
  createPredictionRun,
  getOddsOverridesForDate,
  getPredictionsByDateRange,
  getPredictionsByRunOrDate,
  getResultsByDateRange,
  listPredictionRuns,
  saveEvaluationSummary,
  saveOddsAndSharp,
  savePredictions,
  saveResults,
  saveSlateRows,
  saveTeamStatSnapshot,
  updatePredictionRunExports,
} from '../db/repositories.js'
import { buildPredictionsCsv, buildResultsCsv, type AutomationResultRow } from './csv.js'
import { resolveSharpProvider } from './sharpProvider.js'

export const CURRENT_MODEL_VERSION = 'heuristic-v1'

export type PredictionRunOptions = {
  useOddsOverrides?: boolean
  overrideSource?: string
}

export type AutomationPredictionRow = {
  date: string
  gameTime: string
  awayTeam: TeamAbbr
  homeTeam: TeamAbbr
  awayStarter: string
  homeStarter: string
  awayRuns: number
  homeRuns: number
  total: number
  margin: number
  homeWinProb: number
  awayWinProb: number
  moneylineRec: string
  moneylineEdgePct: number
  runLineRec: string
  runLineEdgePct: number
  totalRec: string
  totalEdgePct: number
  marketTotal: number
  homeML: number
  awayML: number
  runLine: number
  runLineHomeOdds: number
  runLineAwayOdds: number
  overOdds: number
  underOdds: number
  awayLineupConfidence: LineupConfidence
  homeLineupConfidence: LineupConfidence
  starterFreshness: string
  weatherFreshness: string
  sharpFreshness: string
  compositeMarket: 'ML' | 'RL' | 'OU' | 'PASS'
  compositePick: string
  compositeScore: number
  compositeTier: 'A' | 'B' | 'C' | 'PASS'
  compositeReasons: string[]
  lookupKey: string
}

export async function refreshTeamStats(dateInput?: string) {
  const date = assertDateInput(dateInput)
  const snapshot = await fetchTeamRatings(Number.parseInt(date.slice(0, 4), 10))
  await saveTeamStatSnapshot(date, snapshot)
  return snapshot
}

export async function loadSlate(dateInput?: string, options: PredictionRunOptions = {}) {
  const date = assertDateInput(dateInput)
  const rows = await fetchLiveScheduleRows(date)
  const sharpRows = await loadSharpSignals(date, rows)
  const finalRows = options.useOddsOverrides ? await applyOddsOverrides(date, sharpRows, options.overrideSource) : sharpRows
  await saveSlateRows(date, finalRows)
  await saveOddsAndSharp(date, finalRows)
  return finalRows
}

export async function loadSharpSignals(dateInput: string, rows: ScheduleRow[]) {
  const date = assertDateInput(dateInput)
  const provider = resolveSharpProvider(appConfig.sharpProvider)
  const signals = await provider.load(date, rows)
  const byKey = new Map(signals.map((signal) => [signal.lookupKey, signal.normalized]))

  return rows.map((row) => {
    const lookupKey = buildLookupKey(date, row.game.homeTeam, row.game.awayTeam)
    return {
      ...row,
      sharpInput: byKey.get(lookupKey) ?? row.sharpInput,
    }
  })
}

export async function generatePredictions(dateInput?: string, options: PredictionRunOptions = {}) {
  const date = assertDateInput(dateInput)
  const teamSnapshot = await refreshTeamStats(date)
  const slate = await loadSlate(date, options)

  const predictionRows = slate.map((row) => {
    const result = predictGame({
      homeTeam: teamSnapshot.teams[row.game.homeTeam],
      awayTeam: teamSnapshot.teams[row.game.awayTeam],
      homeStarter: row.homeStarter,
      awayStarter: row.awayStarter,
      gameType: 'Regular Season',
      temperature: row.temperature,
      windMph: row.windMph,
      windDirection: row.windDirection,
      homeBullpenFatigue: row.homeBullpenFatigue,
      awayBullpenFatigue: row.awayBullpenFatigue,
      homeBullpenWorkload: row.homeBullpenWorkload,
      awayBullpenWorkload: row.awayBullpenWorkload,
      homeLineupConfidence: row.homeLineupConfidence,
      awayLineupConfidence: row.awayLineupConfidence,
    })

    const projectedRow = { ...row, result }
    const analysis = analyzeBetting(result, row.odds)
    const composite = buildCompositeRecommendation(projectedRow, analysis)

    return {
      date,
      gameTime: row.game.gameTime,
      awayTeam: row.game.awayTeam,
      homeTeam: row.game.homeTeam,
      awayStarter: row.awayStarter.name,
      homeStarter: row.homeStarter.name,
      awayRuns: result.projectedAwayRuns,
      homeRuns: result.projectedHomeRuns,
      total: result.projectedTotal,
      margin: result.projectedMargin,
      homeWinProb: result.homeWinProb,
      awayWinProb: result.awayWinProb,
      moneylineRec: analysis.mlValueSide === 'none' ? 'PASS' : `${analysis.mlValueSide.toUpperCase()} ML`,
      moneylineEdgePct: analysis.mlValuePct,
      runLineRec: analysis.runLineRec.toUpperCase(),
      runLineEdgePct: analysis.runLineEdge,
      totalRec: analysis.ouRec.toUpperCase(),
      totalEdgePct: analysis.ouEdgePct,
      marketTotal: row.odds.overUnder,
      homeML: row.odds.homeMoneyline,
      awayML: row.odds.awayMoneyline,
      runLine: row.odds.runLine,
      runLineHomeOdds: row.odds.runLineHomeOdds,
      runLineAwayOdds: row.odds.runLineAwayOdds,
      overOdds: row.odds.overOdds,
      underOdds: row.odds.underOdds,
      awayLineupConfidence: row.awayLineupConfidence,
      homeLineupConfidence: row.homeLineupConfidence,
      starterFreshness: freshnessLabel(row.starterLastUpdated),
      weatherFreshness: freshnessLabel(row.weatherLastUpdated),
      sharpFreshness: freshnessLabel(row.sharpInput?.lastUpdated),
      compositeMarket: composite.primaryMarket,
      compositePick: composite.pick,
      compositeScore: composite.score,
      compositeTier: composite.tier,
      compositeReasons: composite.reasons,
      lookupKey: buildLookupKey(date, row.game.homeTeam, row.game.awayTeam),
    } satisfies AutomationPredictionRow
  })

  const summary = {
    totalGames: predictionRows.length,
    dbPersisted: isDbConfigured(),
    usedOddsOverrides: Boolean(options.useOddsOverrides),
    overrideSource: options.overrideSource ?? null,
    generatedAt: new Date().toISOString(),
  }

  const run = await createPredictionRun(date, CURRENT_MODEL_VERSION, summary)
  await savePredictions(run?.id ?? null, date, predictionRows)

  return {
    date,
    modelVersion: CURRENT_MODEL_VERSION,
    runId: run?.id ?? null,
    usedOddsOverrides: Boolean(options.useOddsOverrides),
    rows: predictionRows,
  }
}

export async function runDailyPipeline(dateInput?: string, options: PredictionRunOptions = {}) {
  const date = assertDateInput(dateInput)
  const predictions = await generatePredictions(date, options)
  const predictionsExport = await exportPredictionsCsv({
    runId: predictions.runId ?? undefined,
    date,
  })
  const resultsDate = subtractOneDay(date)
  const ingestedResults = await ingestResults(resultsDate)
  const resultsExport = await exportResultsCsv(resultsDate)

  return {
    date,
    resultsDate,
    usedOddsOverrides: Boolean(options.useOddsOverrides),
    overrideSource: options.overrideSource ?? null,
    predictionRunId: predictions.runId,
    predictionCount: predictions.rows.length,
    resultsIngested: ingestedResults.length,
    predictionsExportPath: predictionsExport.path,
    resultsExportPath: resultsExport.path,
  }
}

export async function exportPredictionsCsv(args: { date?: string; runId?: string }) {
  const rows = await readPredictionRows(args)
  const csv = buildPredictionsCsv(rows)
  const fileDate = args.date ?? rows[0]?.date ?? new Date().toISOString().slice(0, 10)
  const outputPath = path.resolve(appConfig.exportDir, `mlb-predictions-${fileDate}.csv`)
  await ensureExportDir()
  await writeFile(outputPath, csv, 'utf8')

  if (args.runId) {
    await updatePredictionRunExports(args.runId, { exportPath: outputPath })
  }

  return {
    path: outputPath,
    csv,
    rowCount: rows.length,
  }
}

export async function ingestResults(dateInput?: string) {
  const date = assertDateInput(dateInput)
  const rows = await fetchCompletedGameResults(date)
  await saveResults(date, rows)
  return rows
}

export async function exportResultsCsv(dateInput?: string) {
  const date = assertDateInput(dateInput)
  const results = await ingestResults(date)
  const rows: AutomationResultRow[] = results.map((row) => ({
    date: row.date,
    home: row.home,
    away: row.away,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    lookupKey: row.lookupKey,
  }))
  const csv = buildResultsCsv(rows)
  const outputPath = path.resolve(appConfig.exportDir, `mlb-results-${date}.csv`)
  await ensureExportDir()
  await writeFile(outputPath, csv, 'utf8')
  return {
    path: outputPath,
    csv,
    rowCount: rows.length,
  }
}

export async function evaluate(dateRange?: { from: string; to: string }) {
  if (!isDbConfigured()) {
    if (appConfig.enableFallbackMode) {
      return {
        mode: 'fallback',
        report: evaluatePredictions([], [], DEFAULT_THRESHOLDS),
      }
    }
    throw new Error('Database-backed evaluation requires DATABASE_URL.')
  }

  const from = assertDateInput(dateRange?.from)
  const to = assertDateInput(dateRange?.to, from)
  const predictionRecords = await getPredictionsByDateRange(from, to)
  const resultRecords = await getResultsByDateRange(from, to)
  const predictions = predictionRecords.map((record) =>
    toParsedPredictionRow(record.payload as unknown as AutomationPredictionRow),
  )
  const results = resultRecords.map((record) => record.payload as unknown as ParsedResultRow)
  const report = evaluatePredictions(predictions, results, DEFAULT_THRESHOLDS)

  await saveEvaluationSummary(
    from,
    to,
    DEFAULT_THRESHOLDS as unknown as Record<string, unknown>,
    report as unknown as Record<string, unknown>,
    CURRENT_MODEL_VERSION,
  )

  return {
    mode: 'database',
    report,
  }
}

export async function getLatestRuns(limit = 10) {
  return listPredictionRuns(limit)
}

export async function getStoredPredictions(args: { runId?: string; date?: string }) {
  return readPredictionRows(args)
}

export async function getStoredResults(from: string, to: string) {
  const rows = await getResultsByDateRange(from, to)
  return rows.map((row) => row.payload as unknown as ParsedResultRow)
}

async function readPredictionRows(args: { runId?: string; date?: string }) {
  const records = await getPredictionsByRunOrDate(args)
  return records.map((record) => record.payload as unknown as AutomationPredictionRow)
}

async function ensureExportDir() {
  await mkdir(path.resolve(appConfig.exportDir), { recursive: true })
}

function buildLookupKey(date: string, homeTeam: TeamAbbr, awayTeam: TeamAbbr) {
  return `${date.replaceAll('-', '')}${homeTeam}${awayTeam}`
}

function freshnessLabel(timestamp?: string | null) {
  return timestamp ?? 'N/A'
}

async function applyOddsOverrides(date: string, rows: ScheduleRow[], source?: string) {
  const overrides = await getOddsOverridesForDate(date, {
    source,
    statuses: ['approved'],
  })

  if (!overrides.length) return rows

  const byLookupKey = new Map(
    overrides.map((override) => [override.lookupKey, override.odds as unknown as ScheduleRow['odds']]),
  )

  return rows.map((row) => {
    const lookupKey = buildLookupKey(date, row.game.homeTeam, row.game.awayTeam)
    const overrideOdds = byLookupKey.get(lookupKey)
    if (!overrideOdds) return row
    return {
      ...row,
      odds: overrideOdds,
    }
  })
}

function toParsedPredictionRow(row: AutomationPredictionRow): ParsedPredictionRow {
  return {
    date: row.date,
    away: row.awayTeam,
    home: row.homeTeam,
    lookupKey: row.lookupKey,
    awayRuns: row.awayRuns,
    homeRuns: row.homeRuns,
    projectedTotal: row.total,
    moneylineRec: row.moneylineRec,
    moneylineEdgePct: row.moneylineEdgePct,
    runLineRec: row.runLineRec,
    runLineEdgePct: row.runLineEdgePct,
    totalRec: row.totalRec,
    totalEdgePct: row.totalEdgePct,
    marketTotal: row.marketTotal,
    homeML: row.homeML,
    awayML: row.awayML,
    runLine: row.runLine,
    runLineHomeOdds: row.runLineHomeOdds,
    runLineAwayOdds: row.runLineAwayOdds,
    overOdds: row.overOdds,
    underOdds: row.underOdds,
  }
}
