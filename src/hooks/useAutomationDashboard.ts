import { useEffect, useState } from 'react'

import {
  approveOddsOverrides,
  captureOddsOverrides,
  fetchAutomationEvaluation,
  fetchLatestAutomationRuns,
  fetchOddsOverrides,
  importOddsOverrides,
  rejectOddsOverrides,
  triggerDailyPipelineRun,
  triggerAutomationPredictionRun,
  triggerAutomationResultsIngest,
  type AutomationOddsOverride,
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

  useEffect(() => {
    const refreshDatesIfStale = () => {
      const currentDay = new Date().toISOString().slice(0, 10)
      setRunDate((prev) => (prev < currentDay ? currentDay : prev))
      setResultsDate((prev) => (prev < subtractDays(currentDay, 1) ? subtractDays(currentDay, 1) : prev))
    }
    const handleVisibility = () => {
      if (!document.hidden) refreshDatesIfStale()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('Checking automation API...')
  const [error, setError] = useState('')
  const [latestRuns, setLatestRuns] = useState<AutomationRun[]>([])
  const [evaluation, setEvaluation] = useState<EvaluationReport | null>(null)
  const [overrideSource, setOverrideSource] = useState('manual-site-copy')
  const [overridePaste, setOverridePaste] = useState('')
  const [useApprovedOverrides, setUseApprovedOverrides] = useState(true)
  const [oddsOverrides, setOddsOverrides] = useState<AutomationOddsOverride[]>([])

  const refresh = async () => {
    setLoading(true)
    setError('')

    try {
      const [runs, evaluationResponse, overrides] = await Promise.all([
        fetchLatestAutomationRuns(),
        fetchAutomationEvaluation(subtractDays(today, 30), subtractDays(today, 1)),
        fetchOddsOverrides(runDate),
      ])

      setLatestRuns(runs)
      setEvaluation(evaluationResponse.report)
      setOddsOverrides(overrides)
      setApiAvailable(true)
      setStatus(
        runs.length
          ? `Automation API live. Loaded ${runs.length} recent runs and ${overrides.length} odds overrides for ${runDate}.`
          : `Automation API live. No persisted runs yet. Loaded ${overrides.length} odds overrides for ${runDate}.`,
      )
    } catch (refreshError) {
      setApiAvailable(false)
      setLatestRuns([])
      setEvaluation(null)
      setOddsOverrides([])
      setStatus('Automation API unavailable. Manual predictor mode is still available.')
      setError(refreshError instanceof Error ? refreshError.message : 'Automation API unavailable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runDate])

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

  const runPipeline = async () => {
    setLoading(true)
    setError('')
    try {
      await triggerDailyPipelineRun(runDate, {
        useOddsOverrides: useApprovedOverrides,
        overrideSource,
      })
      setApiAvailable(true)
      setStatus(
        useApprovedOverrides
          ? `Daily pipeline triggered for ${runDate} using approved overrides from ${overrideSource}.`
          : `Daily pipeline triggered for ${runDate} using fetched odds only.`,
      )
      await refresh()
    } catch (pipelineError) {
      setApiAvailable(false)
      setError(pipelineError instanceof Error ? pipelineError.message : 'Daily pipeline run failed.')
    } finally {
      setLoading(false)
    }
  }

  const importOverrides = async () => {
    if (!overridePaste.trim()) {
      setError('Paste odds text before importing overrides.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await importOddsOverrides(runDate, overridePaste, overrideSource)
      setApiAvailable(true)
      setStatus(`Imported odds overrides for ${runDate} from ${overrideSource}.`)
      await refresh()
    } catch (importError) {
      setApiAvailable(false)
      setError(importError instanceof Error ? importError.message : 'Odds override import failed.')
    } finally {
      setLoading(false)
    }
  }

  const approveAllOverrides = async () => {
    setLoading(true)
    setError('')
    try {
      await approveOddsOverrides(runDate, overrideSource)
      setApiAvailable(true)
      setStatus(`Approved ${overrideSource} odds overrides for ${runDate}.`)
      await refresh()
    } catch (approveError) {
      setApiAvailable(false)
      setError(approveError instanceof Error ? approveError.message : 'Odds override approval failed.')
    } finally {
      setLoading(false)
    }
  }

  const captureOverrides = async () => {
    setLoading(true)
    setError('')
    try {
      await captureOddsOverrides(runDate, overrideSource)
      setApiAvailable(true)
      setStatus(`Captured odds overrides for ${runDate} from ${overrideSource}.`)
      await refresh()
    } catch (captureError) {
      setApiAvailable(false)
      setError(captureError instanceof Error ? captureError.message : 'Browser odds capture failed.')
    } finally {
      setLoading(false)
    }
  }

  const rejectAllOverrides = async () => {
    setLoading(true)
    setError('')
    try {
      await rejectOddsOverrides(runDate, overrideSource)
      setApiAvailable(true)
      setStatus(`Rejected ${overrideSource} odds overrides for ${runDate}.`)
      await refresh()
    } catch (rejectError) {
      setApiAvailable(false)
      setError(rejectError instanceof Error ? rejectError.message : 'Odds override rejection failed.')
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
    overrideSource,
    setOverrideSource,
    overridePaste,
    setOverridePaste,
    useApprovedOverrides,
    setUseApprovedOverrides,
    oddsOverrides,
    refresh,
    runPredictions,
    runPipeline,
    importOverrides,
    captureOverrides,
    approveAllOverrides,
    rejectAllOverrides,
    ingestResults,
  }
}
