import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAutomationDashboard } from './useAutomationDashboard'

const automationApiMocks = vi.hoisted(() => ({
  approveOddsOverrides: vi.fn(),
  captureOddsOverrides: vi.fn(),
  fetchAutomationEvaluation: vi.fn(),
  fetchLatestAutomationRuns: vi.fn(),
  fetchOddsOverrides: vi.fn(),
  importOddsOverrides: vi.fn(),
  rejectOddsOverrides: vi.fn(),
  triggerDailyPipelineRun: vi.fn(),
  triggerAutomationPredictionRun: vi.fn(),
  triggerAutomationResultsIngest: vi.fn(),
}))

vi.mock('../lib/automationApi', () => automationApiMocks)

describe('useAutomationDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('marks the automation API available after a successful refresh', async () => {
    automationApiMocks.fetchLatestAutomationRuns.mockResolvedValue([
      {
        id: 'run-1',
        businessDate: '2026-04-09T00:00:00.000Z',
        modelVersion: 'v1',
        reviewStatus: 'pending',
        status: 'complete',
        exportPath: 'generated/file.csv',
        resultsPath: null,
        createdAt: '2026-04-09T12:00:00.000Z',
        updatedAt: '2026-04-09T12:00:00.000Z',
      },
    ])
    automationApiMocks.fetchAutomationEvaluation.mockResolvedValue({
      mode: 'db',
      report: {
        moneyline: { wins: 1, losses: 0, pushes: 0, pending: 0, roiUnits: 1.2, winPct: '100.0' },
        runLine: { wins: 0, losses: 1, pushes: 0, pending: 0, roiUnits: -1, winPct: '0.0' },
        totals: { wins: 1, losses: 1, pushes: 0, pending: 0, roiUnits: 0.1, winPct: '50.0' },
      },
    })
    automationApiMocks.fetchOddsOverrides.mockResolvedValue([])

    const { result } = renderHook(() => useAutomationDashboard())

    await waitFor(() => {
      expect(result.current.apiAvailable).toBe(true)
    })

    expect(result.current.latestRuns).toHaveLength(1)
    expect(result.current.status).toContain('Automation API live.')
    expect(result.current.error).toBe('')
  })

  it('marks the automation API unavailable when refresh fails', async () => {
    automationApiMocks.fetchLatestAutomationRuns.mockRejectedValue(new Error('Failed to fetch'))
    automationApiMocks.fetchAutomationEvaluation.mockResolvedValue({
      mode: 'db',
      report: {
        moneyline: { wins: 0, losses: 0, pushes: 0, pending: 0, roiUnits: 0, winPct: '0.0' },
        runLine: { wins: 0, losses: 0, pushes: 0, pending: 0, roiUnits: 0, winPct: '0.0' },
        totals: { wins: 0, losses: 0, pushes: 0, pending: 0, roiUnits: 0, winPct: '0.0' },
      },
    })
    automationApiMocks.fetchOddsOverrides.mockResolvedValue([])

    const { result } = renderHook(() => useAutomationDashboard())

    await waitFor(() => {
      expect(result.current.apiAvailable).toBe(false)
    })

    expect(result.current.latestRuns).toHaveLength(0)
    expect(result.current.status).toBe('Automation API unavailable. Manual predictor mode is still available.')
    expect(result.current.error).toBe('Failed to fetch')
  })
})
