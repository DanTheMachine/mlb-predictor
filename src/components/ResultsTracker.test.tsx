import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ResultsTracker } from './ResultsTracker'

function createProps() {
  return {
    resultsStatus: '',
    resultsError: '',
    gradedRows: [],
    stats: {
      ml: { w: 0, l: 0, p: 0, pending: 0, roi: '0.00', pct: '-' },
      rl: { w: 0, l: 0, p: 0, pending: 0, roi: '0.00', pct: '-' },
      ou: { w: 0, l: 0, p: 0, pending: 0, roi: '0.00', pct: '-' },
    },
    handleFetchResults: vi.fn().mockResolvedValue(undefined),
    fetchingResults: false,
    showResultsPaste: false,
    setShowResultsPaste: vi.fn(),
    showPredPaste: false,
    setShowPredPaste: vi.fn(),
    resultsLog: [],
    predLog: [],
    setResultsLog: vi.fn(),
    setPredLog: vi.fn(),
    setResultsStatus: vi.fn(),
    resultsPaste: '',
    setResultsPaste: vi.fn(),
    handleImportResults: vi.fn(),
    predPaste: '',
    setPredPaste: vi.fn(),
    handleImportPredictions: vi.fn(),
  }
}

describe('ResultsTracker', () => {
  it('renders predictions and results editors side by side with import controls', () => {
    render(<ResultsTracker {...createProps()} />)

    expect(screen.getByText('Predictions CSV')).toBeTruthy()
    expect(screen.getByText('Results CSV')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import Predictions' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Import Results' })).toBeTruthy()
    expect(screen.getByRole('button', { name: "Download Yesterday's Results" })).toBeTruthy()
    expect(screen.getByPlaceholderText('Paste the exported mlb-predictions-YYYY-MM-DD.csv content here...')).toBeTruthy()
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
  })

  it('shows pushes inline as W-L-P and allows clearing each editor independently', () => {
    const props = createProps()
    render(
      <ResultsTracker
        {...props}
        predPaste="predictions"
        resultsPaste="results"
        gradedRows={[
          {
            date: '2026-03-29',
            away: 'ATL',
            home: 'LAD',
            lookupKey: '20260329LADATL',
            awayRuns: 3.9,
            homeRuns: 4.8,
            projectedTotal: 8.7,
            moneylineRec: 'HOME ML',
            moneylineEdgePct: 4.1,
            runLineRec: 'PASS',
            runLineEdgePct: null,
            totalRec: 'OVER',
            totalEdgePct: 5.2,
            marketTotal: 8,
            homeML: -145,
            awayML: 125,
            runLine: -1.5,
            runLineHomeOdds: 135,
            runLineAwayOdds: -160,
            overOdds: -110,
            underOdds: -110,
            resultRow: null,
            graded: true,
          },
        ]}
        stats={{
          ml: { w: 7, l: 4, p: 1, pending: 0, roi: '2.50', pct: '63.6' },
          rl: { w: 5, l: 3, p: 0, pending: 2, roi: '1.25', pct: '62.5' },
          ou: { w: 6, l: 5, p: 2, pending: 0, roi: '-0.50', pct: '54.5' },
        }}
      />,
    )

    expect(screen.getByText('7-4-1')).toBeTruthy()
    expect(screen.getByText('5-3 · 2 pending')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]!)
    expect(props.setPredPaste).toHaveBeenCalledWith('')

    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' })[1]!)
    expect(props.setResultsPaste).toHaveBeenCalledWith('')
  })
})
