import type { EvaluationReport } from './modelEvaluation'

const AUTOMATION_API_BASE_URL = 'http://localhost:8788'

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

async function readJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Automation API request failed with ${response.status}. Start the API with npm run api.`)
  }
  return response.json() as Promise<T>
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
