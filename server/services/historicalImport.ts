import { readFile } from 'node:fs/promises'

import type { TeamAbbr } from '../../src/lib/mlbTypes.js'
import { assertDateInput, isDbConfigured } from '../config.js'
import { findOrCreatePredictionRun, savePredictions, saveResults } from '../db/repositories.js'
import type { AutomationPredictionRow } from './mlbAutomation.js'

const IMPORT_MODEL_VERSION = 'legacy-sheet-import-v1'

type ImportedResultRow = {
  date: string
  away: TeamAbbr
  home: TeamAbbr
  awayScore: number
  homeScore: number
  lookupKey: string
}

export async function importHistoricalPredictionsSheet(args: { file: string; source?: string }) {
  if (!isDbConfigured()) {
    throw new Error('Historical import requires DATABASE_URL and DB persistence to be enabled.')
  }

  const source = args.source?.trim() || 'google-sheet-import'
  const raw = await readFile(args.file, 'utf8')
  const rows = parseDelimitedSheet(raw)

  if (rows.length < 2) {
    throw new Error('Import file must include a header row and at least one data row.')
  }

  const headerIndex = rows.findIndex((columns) => looksLikeHeaderRow(columns))
  if (headerIndex < 0) {
    throw new Error('Unable to find the predictions header row in the import file.')
  }

  const headers = rows[headerIndex] ?? []
  const dataRows = rows.slice(headerIndex + 1)
  const importedPredictionsByDate = new Map<string, AutomationPredictionRow[]>()
  const importedResultsByDate = new Map<string, ImportedResultRow[]>()

  for (const columns of dataRows) {
    const row = toRecord(headers, columns)
    const prediction = parsePredictionRow(row)
    if (!prediction) continue

    const date = prediction.date
    const predictions = importedPredictionsByDate.get(date) ?? []
    predictions.push(prediction)
    importedPredictionsByDate.set(date, predictions)

    const result = parseResultRow(row, prediction)
    if (result) {
      const results = importedResultsByDate.get(date) ?? []
      results.push(result)
      importedResultsByDate.set(date, results)
    }
  }

  let importedPredictionCount = 0
  let importedResultCount = 0
  const runIds: Array<{ date: string; runId: string | null }> = []

  for (const [date, predictions] of importedPredictionsByDate.entries()) {
    const run = await findOrCreatePredictionRun(date, IMPORT_MODEL_VERSION, {
      source,
      importedAt: new Date().toISOString(),
      importedPredictionCount: predictions.length,
    })

    await savePredictions(run?.id ?? null, date, predictions)
    runIds.push({ date, runId: run?.id ?? null })
    importedPredictionCount += predictions.length

    const results = dedupeResults(importedResultsByDate.get(date) ?? [])
    if (results.length) {
      await saveResults(date, results)
      importedResultCount += results.length
    }
  }

  return {
    source,
    importedDates: [...importedPredictionsByDate.keys()].sort(),
    importedPredictionCount,
    importedResultCount,
    runIds,
  }
}

function parseDelimitedSheet(text: string) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  const lines = normalized.split('\n').filter(Boolean)
  const delimiter = (lines[0]?.match(/\t/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? '\t' : ','
  return lines.map((line) => splitLine(line, delimiter))
}

function splitLine(line: string, delimiter: string) {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === delimiter && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values.map((value) => value.trim())
}

function toRecord(headers: string[], columns: string[]) {
  return Object.fromEntries(headers.map((header, index) => [normalizeHeader(header), columns[index] ?? ''])) as Record<string, string>
}

function parsePredictionRow(row: Record<string, string>): AutomationPredictionRow | null {
  const date = safeDate(field(row, 'Date'))
  const lookupKey = field(row, 'LookupKey')?.trim()
  const awayTeam = parseTeamAbbr(field(row, 'Away'))
  const homeTeam = parseTeamAbbr(field(row, 'Home'))

  if (!date || !lookupKey || !awayTeam || !homeTeam) {
    return null
  }

  return {
    date,
    gameTime: field(row, 'GameTime')?.trim() || '',
    awayTeam,
    homeTeam,
    awayStarter: field(row, 'AwayStarter')?.trim() || '',
    homeStarter: field(row, 'HomeStarter')?.trim() || '',
    awayRuns: parseNumber(field(row, 'AwayRuns')) ?? 0,
    homeRuns: parseNumber(field(row, 'HomeRuns')) ?? 0,
    total: parseNumber(field(row, 'Total')) ?? 0,
    margin: parseNumber(field(row, 'Margin')) ?? 0,
    homeWinProb: asProbability(field(row, 'HomeWinProb')),
    awayWinProb: asProbability(field(row, 'AwayWinProb')),
    moneylineRec: normalizePass(field(row, 'MoneylineRec')),
    moneylineEdgePct: parseNumber(field(row, 'MoneylineEdgePct')) ?? 0,
    runLineRec: normalizePass(field(row, 'RunLineRec')),
    runLineEdgePct: parseNumber(field(row, 'RunLineEdgePct')) ?? 0,
    totalRec: normalizePass(field(row, 'TotalRec')),
    totalEdgePct: parseNumber(field(row, 'TotalEdgePct')) ?? 0,
    marketTotal: parseNumber(field(row, 'MarketTotal')) ?? 0,
    homeML: parseInteger(field(row, 'HomeML')) ?? 0,
    awayML: parseInteger(field(row, 'AwayML')) ?? 0,
    runLine: parseNumber(field(row, 'RunLine')) ?? 0,
    runLineHomeOdds: parseInteger(field(row, 'RunLineHomeOdds')) ?? 0,
    runLineAwayOdds: parseInteger(field(row, 'RunLineAwayOdds')) ?? 0,
    overOdds: parseInteger(field(row, 'OverOdds')) ?? 0,
    underOdds: parseInteger(field(row, 'UnderOdds')) ?? 0,
    awayLineupConfidence: parseLineupConfidence(field(row, 'AwayLineupConfidence')),
    homeLineupConfidence: parseLineupConfidence(field(row, 'HomeLineupConfidence')),
    starterFreshness: normalizeFreshness(field(row, 'StarterFreshness')),
    weatherFreshness: normalizeFreshness(field(row, 'WeatherFreshness')),
    sharpFreshness: normalizeFreshness(field(row, 'SharpFreshness')),
    compositeMarket: parseCompositeMarket(field(row, 'CompositeMarket')),
    compositePick: normalizePass(field(row, 'CompositePick')),
    compositeScore: parseNumber(field(row, 'CompositeScore')) ?? 0,
    compositeTier: parseCompositeTier(field(row, 'CompositeTier')),
    compositeReasons: splitReasons(field(row, 'CompositeReasons')),
    lookupKey,
  }
}

function parseResultRow(row: Record<string, string>, prediction: AutomationPredictionRow): ImportedResultRow | null {
  const homeScore = parseInteger(field(row, 'Actual Home Score'))
  const awayScore = parseInteger(field(row, 'Actual Away Score'))

  if (homeScore == null || awayScore == null) {
    return null
  }

  return {
    date: prediction.date,
    away: prediction.awayTeam,
    home: prediction.homeTeam,
    awayScore,
    homeScore,
    lookupKey: prediction.lookupKey,
  }
}

function dedupeResults(rows: ImportedResultRow[]) {
  return [...new Map(rows.map((row) => [row.lookupKey, row])).values()]
}

function safeDate(value: string | undefined) {
  if (!value?.trim()) return null
  return assertDateInput(value.trim())
}

function parseTeamAbbr(value: string | undefined) {
  const token = value?.trim().split(/\s+/)[0]?.toUpperCase()
  if (!token) return null
  return token as TeamAbbr
}

function parseNumber(value: string | undefined) {
  if (!value?.trim()) return null
  const parsed = Number.parseFloat(value.replace(/[%,]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value: string | undefined) {
  if (!value?.trim()) return null
  const parsed = Number.parseInt(value.replace(/[,]/g, ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function asProbability(value: string | undefined) {
  const parsed = parseNumber(value)
  if (parsed == null) return 0
  return parsed > 1 ? parsed / 100 : parsed
}

function normalizePass(value: string | undefined) {
  const text = value?.trim()
  return text ? text : 'PASS'
}

function normalizeFreshness(value: string | undefined) {
  const text = value?.trim()
  if (!text) return 'Unknown'
  return text
}

function parseLineupConfidence(value: string | undefined): AutomationPredictionRow['awayLineupConfidence'] {
  const text = value?.trim()
  if (text === 'Confirmed' || text === 'Thin') return text
  return 'Projected'
}

function parseCompositeMarket(value: string | undefined): AutomationPredictionRow['compositeMarket'] {
  const text = value?.trim().toUpperCase()
  if (text === 'ML' || text === 'RL' || text === 'OU') return text
  return 'PASS'
}

function parseCompositeTier(value: string | undefined): AutomationPredictionRow['compositeTier'] {
  const text = value?.trim().toUpperCase()
  if (text === 'A' || text === 'B' || text === 'C') return text
  return 'PASS'
}

function splitReasons(value: string | undefined) {
  const text = value?.trim()
  if (!text) return []
  return text.split('|').map((part) => part.trim()).filter(Boolean)
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').replace(/^"+|"+$/g, '').trim().toLowerCase()
}

function field(row: Record<string, string>, name: string) {
  return row[normalizeHeader(name)]
}

function looksLikeHeaderRow(columns: string[]) {
  const normalized = columns.map(normalizeHeader)
  return normalized.includes('date') && normalized.includes('away') && normalized.includes('home') && normalized.includes('lookupkey')
}
