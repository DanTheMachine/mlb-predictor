import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { analyzeBetting } from '../../src/lib/betting.js'
import { buildCompositeRecommendation } from '../../src/lib/compositeRecommendation.js'
import { fetchCompletedGameResults, fetchLiveScheduleRows, fetchStarterStatsMap, resolveStarterByName, fetchTeamRatings } from '../../src/lib/mlbApi.js'
import type { StarterStatsMap } from '../../src/lib/mlbApi.js'
import { predictGame } from '../../src/lib/mlbModel.js'
import { DEFAULT_THRESHOLDS, evaluatePredictions, type ParsedPredictionRow, type ParsedResultRow } from '../../src/lib/modelEvaluation.js'
import type { LineupConfidence, ScheduleRow, TeamAbbr, TeamStats } from '../../src/lib/mlbTypes.js'
import { appConfig, assertDateInput, isDbConfigured, subtractOneDay } from '../config.js'
import {
  createPredictionFileRecord,
  createPredictionRun,
  createResultFileRecord,
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

export async function loadSlate(dateInput?: string, options: PredictionRunOptions = {}, liveTeams?: Record<TeamAbbr, TeamStats>) {
  const date = assertDateInput(dateInput)
  const season = Number(date.slice(0, 4)) || new Date().getFullYear()
  const starterStatsMap = await fetchStarterStatsMap(season)
  const rows = await fetchLiveScheduleRows(date, { liveTeams, starterStatsFetcher: () => Promise.resolve(starterStatsMap) })
  console.log(`[loadSlate] fetchLiveScheduleRows → ${rows.length} rows`)
  const sharpRows = await loadSharpSignals(date, rows)
  const finalRows = options.useOddsOverrides ? await applyOddsOverrides(date, sharpRows, options.overrideSource, starterStatsMap) : sharpRows
  console.log(`[loadSlate] finalRows after overrides → ${finalRows.length} rows`)
  await saveSlateRows(date, finalRows)
  await saveOddsAndSharp(date, finalRows)
  return finalRows
}

export async function loadSharpSignals(dateInput: string, rows: ScheduleRow[]) {
  const date = assertDateInput(dateInput)
  const provider = resolveSharpProvider(appConfig.sharpProvider)
  const signals = await provider.load(date, rows)
  const byKey = new Map(signals.map((signal) => [signal.lookupKey, signal.normalized]))
  const seenCounts = new Map<string, number>()

  return rows.map((row) => {
    const baseKey = buildLookupKey(date, row.game.homeTeam, row.game.awayTeam)
    const count = (seenCounts.get(baseKey) ?? 0) + 1
    seenCounts.set(baseKey, count)
    const lookupKey = count === 1 ? baseKey : `${baseKey}_${count}`
    return {
      ...row,
      sharpInput: byKey.get(lookupKey) ?? row.sharpInput,
    }
  })
}

export async function generatePredictions(dateInput?: string, options: PredictionRunOptions = {}) {
  const date = assertDateInput(dateInput)
  const teamSnapshot = await refreshTeamStats(date)
  const slate = await loadSlate(date, options, teamSnapshot.teams)

  const seenCounts = new Map<string, number>()
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
      leagueAvgRunsPerGame: teamSnapshot.leagueAvgRunsPerGame,
    })

    const projectedRow = { ...row, result }
    const analysis = analyzeBetting(result, row.odds)
    const composite = buildCompositeRecommendation(projectedRow, analysis)
    const baseKey = buildLookupKey(date, row.game.homeTeam, row.game.awayTeam)
    const seqCount = (seenCounts.get(baseKey) ?? 0) + 1
    seenCounts.set(baseKey, seqCount)
    const lookupKey = seqCount === 1 ? baseKey : `${baseKey}_${seqCount}`

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
      lookupKey,
    } satisfies AutomationPredictionRow
  })

  console.log(`[generatePredictions] ${predictionRows.length} rows generated:`, predictionRows.map((r) => r.lookupKey))

  const summary = {
    totalGames: predictionRows.length,
    dbPersisted: isDbConfigured(),
    usedOddsOverrides: Boolean(options.useOddsOverrides),
    overrideSource: options.overrideSource ?? null,
    generatedAt: new Date().toISOString(),
  }

  const run = await createPredictionRun(date, CURRENT_MODEL_VERSION, summary)
  const saved = await savePredictions(run?.id ?? null, date, predictionRows)
  if (saved !== predictionRows.length) {
    console.warn(`[generatePredictions] expected to save ${predictionRows.length} rows but saved ${saved} — duplicate lookupKeys in slate`)
  }

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
  await createPredictionFileRecord({
    date: fileDate,
    path: outputPath,
    source: 'automation-export',
    fileRole: 'export',
    runId: args.runId ?? null,
    metadata: {
      rowCount: rows.length,
    },
  })

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
  await createResultFileRecord({
    date,
    path: outputPath,
    source: 'automation-export',
    fileRole: 'export',
    metadata: {
      rowCount: rows.length,
    },
  })
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
  const rows = records.map((record) => record.payload as unknown as AutomationPredictionRow)
  return rows.sort((a, b) => parseGameTime(a.gameTime) - parseGameTime(b.gameTime))
}

function parseGameTime(gameTime: string): number {
  // Parses "10:05 AM" / "6:40 PM" into a sortable number (minutes since midnight)
  const match = gameTime.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match || !match[1] || !match[2] || !match[3]) return 0
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
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

function parseTimeToMinutes(time: string): number {
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i)
  if (!match || !match[1] || !match[2] || !match[3]) return -1
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const meridiem = match[3].toUpperCase()
  if (meridiem === 'PM' && hours !== 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0
  return hours * 60 + minutes
}

async function applyOddsOverrides(date: string, rows: ScheduleRow[], source?: string, starterStatsMap?: StarterStatsMap) {
  const overrides = await getOddsOverridesForDate(date, {
    source,
    statuses: ['approved'],
  })

  if (!overrides.length) return rows

  // Group overrides by base matchup key (strip _N suffix).
  const byMatchup = new Map<string, typeof overrides>()
  for (const override of overrides) {
    const baseKey = override.lookupKey.replace(/_\d+$/, '')
    const list = byMatchup.get(baseKey) ?? []
    list.push(override)
    byMatchup.set(baseKey, list)
  }

  // Group row indices by base matchup key (preserving slate order).
  const rowIndicesByMatchup = new Map<string, number[]>()
  rows.forEach((row, idx) => {
    const baseKey = buildLookupKey(date, row.game.homeTeam, row.game.awayTeam)
    const list = rowIndicesByMatchup.get(baseKey) ?? []
    list.push(idx)
    rowIndicesByMatchup.set(baseKey, list)
  })

  // Pre-compute which override (if any) each row index receives.
  // Strategy:
  //   1. Time matching (within 90 min) when overrides have a stored gameTime.
  //      Handles future-dated or postponed games where the API eventually has
  //      correct times.
  //   2. Align-from-right when times are missing or all deltas exceed 90 min.
  //      When only N overrides exist for M slate rows (N < M), the paste is
  //      missing the earliest games because they have already started and were
  //      removed from the sportsbook.  Assign overrides to the last N rows so
  //      the upcoming games get the correct odds/starters.
  const rowOverrideMap = new Map<number, (typeof overrides)[number]>()

  for (const [baseKey, candidates] of byMatchup) {
    const slateIndices = rowIndicesByMatchup.get(baseKey) ?? []
    if (slateIndices.length === 0 || candidates.length === 0) continue

    const timedCandidates = candidates.filter((c) => {
      const t = (c.metadata as Record<string, unknown> | null)?.gameTime
      return typeof t === 'string' && t.length > 0
    })

    if (timedCandidates.length > 0) {
      // Try time-proximity matching for each slate row.
      const assigned = new Set<typeof overrides[number]>()
      for (const idx of slateIndices) {
        const slateMin = parseTimeToMinutes(rows[idx]!.game.gameTime)
        let best: (typeof overrides)[number] | undefined
        let bestDelta = Infinity
        for (const candidate of timedCandidates) {
          if (assigned.has(candidate)) continue
          const overrideMin = parseTimeToMinutes((candidate.metadata as Record<string, unknown>).gameTime as string)
          const delta = Math.abs(overrideMin - slateMin)
          if (delta < bestDelta) {
            bestDelta = delta
            best = candidate
          }
        }
        // Only accept if within 90 minutes (guards against timezone mismatches or
        // stale MLB API placeholder times for doubleheader game 2).
        if (best && bestDelta <= 90) {
          rowOverrideMap.set(idx, best)
          assigned.add(best)
        }
      }

      // Fall back to align-from-right for any rows that got no time match.
      const unmatched = slateIndices.filter((idx) => !rowOverrideMap.has(idx))
      const unused = candidates.filter((c) => !assigned.has(c))
      const alignStart = unmatched.length - unused.length
      unused.forEach((candidate, i) => {
        const idx = unmatched[alignStart + i]
        if (idx !== undefined) rowOverrideMap.set(idx, candidate)
      })
    } else {
      // No stored times — align overrides to the last N slate rows.
      const alignStart = slateIndices.length - candidates.length
      candidates.forEach((candidate, i) => {
        const idx = slateIndices[alignStart + i]
        if (idx !== undefined) rowOverrideMap.set(idx, candidate)
      })
    }
  }

  return rows.map((row, idx) => {
    const override = rowOverrideMap.get(idx)
    if (!override) return row

    const updatedRow: ScheduleRow = {
      ...row,
      odds: override.odds as unknown as ScheduleRow['odds'],
    }

    if (override.awayStarter && row.awayStarter.name === 'TBD') {
      updatedRow.awayStarter = resolveStarterByName(override.awayStarter, row.game.awayTeam, starterStatsMap)
    }
    if (override.homeStarter && row.homeStarter.name === 'TBD') {
      updatedRow.homeStarter = resolveStarterByName(override.homeStarter, row.game.homeTeam, starterStatsMap)
    }

    return updatedRow
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
