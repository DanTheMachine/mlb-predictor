import { useEffect, useState } from 'react'

import {
  fetchAutomationEvaluation,
  fetchLatestAutomationRuns,
  triggerAutomationPredictionRun,
  triggerAutomationResultsIngest,
  type AutomationRun,
} from '../lib/automationApi'
import type { EvaluationReport } from '../lib/modelEvaluation'

function subtractDays(date: string, days: number) {
  const stamp = new Date(`${date}T12:00:00`)
  stamp.setDate(stamp.getDate() - days)
  return stamp.toISOString().slice(0, 10)
}

export function useAutomationDashboard() {
  const today = new Date().toISOString().slice(0, 10)
  const [runDate, setRunDate] = useState(today)
  const [resultsDate, setResultsDate] = useState(subtractDays(today, 1))
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Checking automation API...')
  const [error, setError] = useState('')
  const [latestRuns, setLatestRuns] = useState<AutomationRun[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError('')

    try {
      const [runs, evaluationResponse] = await Promise.all([
        fetchLatestAutomationRuns(),
        fetchAutomationEvaluation(subtractDays(today, 30), subtractDays(today, 1)),
      ])

      setLatestRuns(runs)
      setEvaluation(evaluationResponse.report)
      setApiAvailable(true)
      setStatus(runs.length ? `Automation API live. Loaded ${runs.length} recent runs.` : 'Automation API live. No persisted runs yet.')
    } catch (refreshError) {
      setApiAvailable(false)
      setLatestRuns([])
      setEvaluation(null)
      setStatus('Automation API unavailable. Manual predictor mode is still available.')
      setError(refreshError instanceof Error ? refreshError.message : 'Automation API unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runPredictions = async () => {
    setLoading(true)
    setError('')
    try {
      await triggerAutomationPredictionRun(runDate)
      setApiAvailable(true)
      setStatus(`Automation prediction run triggered for ${runDate}.`)
      await refresh()
    } catch (runError) {
      setApiAvailable(false)
      setError(runError instanceof Error ? runError.message : 'Automation prediction run failed.')
    } finally {
      setLoading(false)
    }
  }

  const ingestResults = async () => {
    setLoading(true)
    setError('')
    try {
      await triggerAutomationResultsIngest(resultsDate)
      setApiAvailable(true)
      setStatus(`Automation result ingestion triggered for ${resultsDate}.`)
      await refresh()
    } catch (ingestError) {
      setApiAvailable(false)
      setError(ingestError instanceof Error ? ingestError.message : 'Automation results ingest failed.')
    } finally {
      setLoading(false)
    }
  }

  return {
    runDate,
    setRunDate,
    resultsDate,
    setResultsDate,
    apiAvailable,
    loading,
    status,
    error,
    latestRuns,
    evaluation,
    refresh,
    runPredictions,
    ingestResults,
  }
}
