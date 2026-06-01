import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

import { assertDateInput, isDbConfigured } from '../config.js'
import {
  getPredictionsByDateRange,
  getResultsByDateRange,
  getSlateGamesByDateRange,
  getTeamStatSnapshotsByDateRange,
} from '../db/repositories.js'
import type { AutomationPredictionRow } from './mlbAutomation.js'
import type { ScheduleRow } from '../../src/lib/mlbTypes.js'

export type ResidualRow = {
  date: string
  lookupKey: string
  homeTeam: string
  awayTeam: string
  homeStarter: string
  awayStarter: string
  projectedHomeRuns: number
  projectedAwayRuns: number
  actualHomeRuns: number
  actualAwayRuns: number
  residualHome: number
  residualAway: number
  // Input features from slate context
  temperature: number | null
  windMph: number | null
  windDirection: string | null
  parkFactor: number | null
  homeStarterEra: number | null
  homeStarterFip: number | null
  awayStarterEra: number | null
  awayStarterFip: number | null
  homeBullpenFatigue: string | null
  awayBullpenFatigue: string | null
  homeLineupConfidence: string | null
  awayLineupConfidence: string | null
  marketTotal: number | null
  dayOfWeek: number   // 0=Sun … 6=Sat
  monthOfSeason: number
}

export type ExportResidualArgs = {
  from: string
  to: string
  file: string
}

export type ExportResidualResult = {
  totalPredictions: number
  totalResults: number
  joined: number
  excluded: number
  exclusionReasons: Record<string, number>
  written: number
  file: string
}

const MIN_CLEAN_ROWS = 200
const MIN_TOTAL_RUNS_THRESHOLD = 5   // filter likely incomplete games
const EXTREME_TOTAL_THRESHOLD = 25   // flag suspiciously high-scoring games

export async function exportResiduals(args: ExportResidualArgs): Promise<ExportResidualResult> {
  if (!isDbConfigured()) {
    throw new Error('export-residuals requires DATABASE_URL and ENABLE_DB_PERSISTENCE=true.')
  }

  const from = assertDateInput(args.from)
  const to = assertDateInput(args.to, from)

  const [predictionRecords, resultRecords, slateRecords, teamStatSnapshots] = await Promise.all([
    getPredictionsByDateRange(from, to),
    getResultsByDateRange(from, to),
    getSlateGamesByDateRange(from, to),
    getTeamStatSnapshotsByDateRange(from, to),
  ])

  // Index results and slate context by lookupKey (keep most recent per key)
  const resultByKey = new Map<string, { homeScore: number; awayScore: number; businessDate: Date }>()
  for (const r of resultRecords) {
    const existing = resultByKey.get(r.lookupKey)
    if (!existing || r.businessDate > existing.businessDate) {
      resultByKey.set(r.lookupKey, {
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        businessDate: r.businessDate,
      })
    }
  }

  const slateByKey = new Map<string, ScheduleRow>()
  for (const s of slateRecords) {
    if (!slateByKey.has(s.lookupKey)) {
      slateByKey.set(s.lookupKey, s.context as unknown as ScheduleRow)
    }
  }

  // Index park factors by date → team abbr (from team stat snapshots)
  const parkFactorByDate = new Map<string, Record<string, { parkFactor: number }>>()
  for (const snap of teamStatSnapshots) {
    parkFactorByDate.set(snap.date, snap.teams)
  }

  const exclusionReasons: Record<string, number> = {}
  const rows: ResidualRow[] = []

  // Deduplicate predictions by lookupKey (keep most recent run)
  const seenPredictions = new Map<string, typeof predictionRecords[number]>()
  for (const p of predictionRecords) {
    const existing = seenPredictions.get(p.lookupKey)
    if (!existing || p.createdAt > existing.createdAt) {
      seenPredictions.set(p.lookupKey, p)
    }
  }

  for (const pred of seenPredictions.values()) {
    const payload = pred.payload as unknown as AutomationPredictionRow
    const result = resultByKey.get(pred.lookupKey)

    if (!result) {
      bump(exclusionReasons, 'no_result')
      continue
    }

    const actualTotal = result.homeScore + result.awayScore

    // Filter likely incomplete or abnormal games
    if (actualTotal < MIN_TOTAL_RUNS_THRESHOLD) {
      bump(exclusionReasons, 'incomplete_game')
      continue
    }

    // Flag extreme outliers but keep them; log count separately
    if (actualTotal >= EXTREME_TOTAL_THRESHOLD) {
      bump(exclusionReasons, 'extreme_total_flagged')
      // Do not skip — just count. Caller can decide to filter in Python.
    }

    if (payload.homeRuns == null || payload.awayRuns == null) {
      bump(exclusionReasons, 'missing_projection')
      continue
    }

    const slate = slateByKey.get(pred.lookupKey)
    const slateCtx = slate ?? null

    const dateStr = pred.businessDate.toISOString().slice(0, 10)
    const dayOfWeek = pred.businessDate.getUTCDay()
    const monthOfSeason = pred.businessDate.getUTCMonth() + 1

    rows.push({
      date: dateStr,
      lookupKey: pred.lookupKey,
      homeTeam: pred.homeTeam,
      awayTeam: pred.awayTeam,
      homeStarter: payload.homeStarter,
      awayStarter: payload.awayStarter,
      projectedHomeRuns: payload.homeRuns,
      projectedAwayRuns: payload.awayRuns,
      actualHomeRuns: result.homeScore,
      actualAwayRuns: result.awayScore,
      residualHome: result.homeScore - payload.homeRuns,
      residualAway: result.awayScore - payload.awayRuns,
      temperature: slateCtx?.temperature ?? null,
      windMph: slateCtx?.windMph ?? null,
      windDirection: slateCtx?.windDirection ?? null,
      parkFactor: parkFactorByDate.get(dateStr)?.[pred.homeTeam]?.parkFactor ?? null,
      homeStarterEra: slateCtx?.homeStarter?.era ?? null,
      homeStarterFip: slateCtx?.homeStarter?.fip ?? null,
      awayStarterEra: slateCtx?.awayStarter?.era ?? null,
      awayStarterFip: slateCtx?.awayStarter?.fip ?? null,
      homeBullpenFatigue: slateCtx?.homeBullpenFatigue ?? null,
      awayBullpenFatigue: slateCtx?.awayBullpenFatigue ?? null,
      homeLineupConfidence: slateCtx?.homeLineupConfidence ?? null,
      awayLineupConfidence: slateCtx?.awayLineupConfidence ?? null,
      marketTotal: payload.marketTotal ?? null,
      dayOfWeek,
      monthOfSeason,
    })
  }

  const cleanRows = rows.filter((r) => r.actualHomeRuns + r.actualAwayRuns < EXTREME_TOTAL_THRESHOLD)
  const excluded = (seenPredictions.size) - rows.length + (exclusionReasons['extreme_total_flagged'] ?? 0)

  if (cleanRows.length < MIN_CLEAN_ROWS) {
    throw new Error(
      `export-residuals: only ${cleanRows.length} clean rows available (minimum ${MIN_CLEAN_ROWS}). ` +
        `Accumulate more graded games before training. Exclusions: ${JSON.stringify(exclusionReasons)}`,
    )
  }

  console.log(`[exportResiduals] ${predictionRecords.length} predictions, ${resultRecords.length} results`)
  console.log(`[exportResiduals] joined: ${rows.length}, excluded: ${excluded}`)
  if (Object.keys(exclusionReasons).length > 0) {
    console.log(`[exportResiduals] exclusion breakdown:`, exclusionReasons)
  }

  const csv = buildResidualsCsv(rows)
  await mkdir(path.dirname(path.resolve(args.file)), { recursive: true })
  await writeFile(path.resolve(args.file), csv, 'utf-8')

  return {
    totalPredictions: predictionRecords.length,
    totalResults: resultRecords.length,
    joined: rows.length,
    excluded,
    exclusionReasons,
    written: rows.length,
    file: path.resolve(args.file),
  }
}

function bump(record: Record<string, number>, key: string) {
  record[key] = (record[key] ?? 0) + 1
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function buildResidualsCsv(rows: ResidualRow[]) {
  const header = [
    'Date',
    'LookupKey',
    'HomeTeam',
    'AwayTeam',
    'HomeStarter',
    'AwayStarter',
    'ProjectedHomeRuns',
    'ProjectedAwayRuns',
    'ActualHomeRuns',
    'ActualAwayRuns',
    'ResidualHome',
    'ResidualAway',
    'Temperature',
    'WindMph',
    'WindDirection',
    'ParkFactor',
    'HomeStarterEra',
    'HomeStarterFip',
    'AwayStarterEra',
    'AwayStarterFip',
    'HomeBullpenFatigue',
    'AwayBullpenFatigue',
    'HomeLineupConfidence',
    'AwayLineupConfidence',
    'MarketTotal',
    'DayOfWeek',
    'MonthOfSeason',
  ]

  const lines = rows.map((row) =>
    [
      row.date,
      row.lookupKey,
      row.homeTeam,
      row.awayTeam,
      row.homeStarter,
      row.awayStarter,
      row.projectedHomeRuns.toFixed(3),
      row.projectedAwayRuns.toFixed(3),
      row.actualHomeRuns,
      row.actualAwayRuns,
      row.residualHome.toFixed(3),
      row.residualAway.toFixed(3),
      row.temperature,
      row.windMph,
      row.windDirection,
      row.parkFactor,
      row.homeStarterEra,
      row.homeStarterFip,
      row.awayStarterEra,
      row.awayStarterFip,
      row.homeBullpenFatigue,
      row.awayBullpenFatigue,
      row.homeLineupConfidence,
      row.awayLineupConfidence,
      row.marketTotal,
      row.dayOfWeek,
      row.monthOfSeason,
    ]
      .map(csvEscape)
      .join(','),
  )

  return [header.map(csvEscape).join(','), ...lines].join('\n')
}
