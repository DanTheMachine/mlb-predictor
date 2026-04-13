import type { EvaluationReport } from './modelEvaluation'

const AUTOMATION_API_BASE_URL = (import.meta.env.VITE_AUTOMATION_API_BASE_URL || 'http://localhost:8788').replace(/\/$/, '')

export type AutomationRun = {
  id: string
  businessDate: string
  modelVersion: string
  reviewStatus: string
  status: string
  exportPath: string | null
  resultsPath: string | null
  createdAt: string
  updatedAt: string
}

export type AutomationOddsOverride = {
  date: string
  lookupKey: string
  awayTeam: string
  homeTeam: string
  source: string
  status: string
  odds: {
    source: 'manual' | 'espn' | 'model'
    homeMoneyline: number
    awayMoneyline: number
    runLine: number
    runLineHomeOdds: number
    runLineAwayOdds: number
    overUnder: number
    overOdds: number
    underOdds: number
  }
  metadata?: Record<string, unknown> | null
}

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Automation API request failed with ${response.status}. Start the API with npm run api.`)
  }
  return response.json() as Promise<T>
}

export type StoredPredictionRow = {
  date: string
  gameTime: string
  awayTeam: string
  homeTeam: string
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
  awayLineupConfidence: string
  homeLineupConfidence: string
  starterFreshness: string
  weatherFreshness: string
  sharpFreshness: string
  compositeMarket: string
  compositePick: string
  compositeScore: number
  compositeTier: string
  compositeReasons: string[]
  lookupKey: string
}

export async function fetchStoredPredictions(date: string) {
  return readJson<StoredPredictionRow[]>(
    `${AUTOMATION_API_BASE_URL}/api/automation/predictions?date=${encodeURIComponent(date)}`,
  )
}

export async function fetchLatestAutomationRuns(limit = 10) {
  return readJson<AutomationRun[]>(`${AUTOMATION_API_BASE_URL}/api/automation/runs/latest?limit=${encodeURIComponent(String(limit))}`)
}

export async function fetchAutomationEvaluation(from: string, to: string) {
  return readJson<{ mode: string; report: EvaluationReport }>(
    `${AUTOMATION_API_BASE_URL}/api/automation/evaluation?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  )
}

export async function triggerAutomationPredictionRun(date: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/predictions/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  })
}

export async function triggerAutomationResultsIngest(date: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/results/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  })
}

export async function triggerDailyPipelineRun(date: string, args?: { useOddsOverrides?: boolean; overrideSource?: string }) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date,
      useOddsOverrides: args?.useOddsOverrides === true,
      overrideSource: args?.overrideSource,
    }),
  })
}

export async function fetchOddsOverrides(date: string) {
  return readJson<AutomationOddsOverride[]>(
    `${AUTOMATION_API_BASE_URL}/api/automation/odds-overrides?date=${encodeURIComponent(date)}`,
  )
}

export async function importOddsOverrides(date: string, raw: string, source: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/odds-overrides/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, raw, source }),
  })
}

export async function captureOddsOverrides(date: string, source: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/odds-overrides/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, source }),
  })
}

export async function approveOddsOverrides(date: string, source: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/odds-overrides/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, source }),
  })
}

export async function rejectOddsOverrides(date: string, source: string) {
  return readJson(`${AUTOMATION_API_BASE_URL}/api/automation/odds-overrides/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, source }),
  })
}
