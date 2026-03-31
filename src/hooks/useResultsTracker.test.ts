import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useResultsTracker } from './useResultsTracker'

vi.mock('../lib/mlbApi', () => ({
  fetchCompletedGameResults: vi.fn(),
}))

const predictionsCsv = `"Date","GameTime","Away","Home","AwayRuns","HomeRuns","Total","LookupKey","AwayStarter","HomeStarter","MoneylineRec","MoneylineEdgePct","RunLineRec","RunLineEdgePct","TotalRec","TotalEdgePct","MarketTotal","HomeML","AwayML","RunLine","RunLineHomeOdds","RunLineAwayOdds","OverOdds","UnderOdds"
"2026-03-25","7:10 PM","ATL","LAD","3.90","4.80","8.70","20260325LADATL","Chris Sale","Tyler Glasnow","HOME ML","4.1","PASS","","OVER","5.2","8.0","-145","+125","-1.5","+135","-160","-110","-110"`

const resultsCsv = `"Date","Home","Away","Home Score","Away Score","LookupKey"
"2026-03-25","LAD","ATL","6","3","20260325LADATL"`

describe('useResultsTracker', () => {
  it('dedupes imported results and predictions across repeated imports', () => {
    const { result } = renderHook(() => useResultsTracker())

    act(() => {
      result.current.setResultsPaste(resultsCsv)
      result.current.handleImportResults()
    })

    act(() => {
      result.current.setResultsPaste(resultsCsv)
      result.current.handleImportResults()
    })

    act(() => {
      result.current.setPredPaste(predictionsCsv)
      result.current.handleImportPredictions()
    })

    act(() => {
      result.current.setPredPaste(predictionsCsv)
      result.current.handleImportPredictions()
    })

    expect(result.current.resultsLog).toHaveLength(1)
    expect(result.current.predLog).toHaveLength(1)
  })

  it('grades imported prediction and result logs into tracker stats', () => {
    const { result } = renderHook(() => useResultsTracker())

    act(() => {
      result.current.setResultsPaste(resultsCsv)
    })
    act(() => {
      result.current.handleImportResults()
    })
    act(() => {
      result.current.setPredPaste(predictionsCsv)
    })
    act(() => {
      result.current.handleImportPredictions()
    })

    expect(result.current.gradedRows).toHaveLength(1)
    expect(result.current.gradedRows[0]).toMatchObject({
      graded: true,
      moneylineWin: true,
      totalWin: true,
      actualTotal: 9,
      actualMargin: 3,
    })
    expect(result.current.stats.ml).toMatchObject({
      w: 1,
      l: 0,
      pct: '100.0',
    })
    expect(result.current.stats.ou).toMatchObject({
      w: 1,
      l: 0,
      pct: '100.0',
    })
  })
})
