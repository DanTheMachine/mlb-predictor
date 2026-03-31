import { useMemo, useState } from 'react'

import { fetchCompletedGameResults, type GradingResultRow } from '../lib/mlbApi'
import { parsePredictionsCsv, parseResultsCsv, type ParsedPredictionRow, type ParsedResultRow } from '../lib/modelEvaluation'
import { gradeTrackedGames, summarizeTrackedGames } from '../lib/resultsTracker'

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function downloadCsv(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function resultRowsToCsv(rows: GradingResultRow[]) {
  const header = ['Date', 'Home', 'Away', 'Home Score', 'Away Score', 'Winner', 'Total', 'LookupKey']
  const lines = rows.map((row) =>
    [
      row.date,
      row.home,
      row.away,
      String(row.homeScore),
      String(row.awayScore),
      row.homeScore > row.awayScore ? row.home : row.away,
      String(row.homeScore + row.awayScore),
      row.lookupKey,
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  )

  return [header.map((value) => `"${value}"`).join(','), ...lines].join('\n')
}

function subtractOneDay(date: string) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() - 1)
  return value.toISOString().slice(0, 10)
}

export function useResultsTracker() {
  const [resultsPaste, setResultsPaste] = useState('')
  const [resultsLog, setResultsLog] = useState<ParsedResultRow[]>([])
  const [resultsStatus, setResultsStatus] = useState('')
  const [resultsError, setResultsError] = useState('')
  const [fetchingResults, setFetchingResults] = useState(false)
  const [showResultsPaste, setShowResultsPaste] = useState(false)
  const [predPaste, setPredPaste] = useState('')
  const [predLog, setPredLog] = useState<ParsedPredictionRow[]>([])
  const [showPredPaste, setShowPredPaste] = useState(false)

  const handleFetchResults = async (date = new Date().toISOString().slice(0, 10), autoImport = false) => {
    setFetchingResults(true)
    setResultsError('')
    const resultsDate = subtractOneDay(date)
    setResultsStatus(`Fetching MLB results for ${resultsDate}...`)

    try {
      const rows = await fetchCompletedGameResults(resultsDate)
      if (!rows.length) {
        setResultsStatus(`No final MLB games found for ${resultsDate}.`)
        return
      }

      downloadCsv(resultRowsToCsv(rows), `mlb-results-${resultsDate}.csv`)
      setResultsStatus(`Downloaded ${rows.length} MLB results for ${resultsDate}.`)

      if (autoImport) {
        setResultsLog((prev) => {
          const existing = new Set(prev.map((row) => row.lookupKey))
          const added = rows
            .map((row) => ({
              date: row.date,
              away: row.away,
              home: row.home,
              awayScore: row.awayScore,
              homeScore: row.homeScore,
              lookupKey: row.lookupKey,
            }))
            .filter((row) => !existing.has(row.lookupKey))

          return [...prev, ...added].sort((a, b) => `${b.date}${b.lookupKey}`.localeCompare(`${a.date}${a.lookupKey}`))
        })
      }
    } catch (error) {
      setResultsError(getErrorMessage(error))
    } finally {
      setFetchingResults(false)
    }
  }

  const handleImportResults = () => {
    setResultsError('')
    try {
      const parsed = parseResultsCsv(resultsPaste)
      setResultsLog((prev) => {
        const existing = new Set(prev.map((row) => row.lookupKey))
        const added = parsed.filter((row) => !existing.has(row.lookupKey))
        return [...prev, ...added].sort((a, b) => `${b.date}${b.lookupKey}`.localeCompare(`${a.date}${a.lookupKey}`))
      })
      setResultsStatus(`Imported ${parsed.length} results.`)
      setResultsPaste('')
      setShowResultsPaste(false)
    } catch (error) {
      setResultsError(getErrorMessage(error))
    }
  }

  const handleImportPredictions = () => {
    setResultsError('')
    try {
      const parsed = parsePredictionsCsv(predPaste)
      setPredLog((prev) => {
        const existing = new Set(prev.map((row) => row.lookupKey))
        const added = parsed.filter((row) => !existing.has(row.lookupKey))
        return [...prev, ...added].sort((a, b) => `${b.date}${b.lookupKey}`.localeCompare(`${a.date}${a.lookupKey}`))
      })
      setResultsStatus(`Imported ${parsed.length} predictions.`)
      setPredPaste('')
      setShowPredPaste(false)
    } catch (error) {
      setResultsError(getErrorMessage(error))
    }
  }

  const gradedRows = useMemo(() => gradeTrackedGames(predLog, resultsLog), [predLog, resultsLog])
  const stats = useMemo(() => summarizeTrackedGames(gradedRows), [gradedRows])

  return {
    resultsPaste,
    setResultsPaste,
    resultsLog,
    setResultsLog,
    resultsStatus,
    setResultsStatus,
    resultsError,
    fetchingResults,
    showResultsPaste,
    setShowResultsPaste,
    predPaste,
    setPredPaste,
    predLog,
    setPredLog,
    showPredPaste,
    setShowPredPaste,
    handleFetchResults,
    handleImportResults,
    handleImportPredictions,
    gradedRows,
    stats,
  }
}
