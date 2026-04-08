import { describe, expect, it } from 'vitest'

import { americanToImplied, analyzeBetting } from './betting'
import type { OddsInput, PredictionResult } from './mlbTypes'

describe('betting helpers', () => {
  it('converts american odds to implied probability', () => {
    expect(americanToImplied(-150)).toBeCloseTo(0.6, 3)
    expect(americanToImplied(130)).toBeCloseTo(0.4348, 3)
  })

  it('recommends a side when model and market are far apart', () => {
    const result: PredictionResult = {
      projectedHomeRuns: 5.1,
      projectedAwayRuns: 3.7,
      projectedTotal: 8.8,
      projectedMargin: 1.4,
      homeWinProb: 0.64,
      awayWinProb: 0.36,
      homeRunLineCoverProb: 0.54,
      awayRunLineCoverProb: 0.46,
      overProb: 0.58,
      underProb: 0.42,
      homeStarterInnings: 6.2,
      awayStarterInnings: 5.6,
      modelLean: 'Home side lean',
      features: [],
    }

    const odds: OddsInput = {
      source: 'manual',
      homeMoneyline: -125,
      awayMoneyline: 115,
      runLine: -1.5,
      runLineHomeOdds: 145,
      runLineAwayOdds: -170,
      overUnder: 7.5,
      overOdds: -108,
      underOdds: -112,
    }

    const analysis = analyzeBetting(result, odds)

    expect(analysis.mlValueSide).toBe('home')
    expect(analysis.ouRec).toBe('over')
  })

  it('labels the away run line using the opposite of the home line', () => {
    const result: PredictionResult = {
      projectedHomeRuns: 2.9,
      projectedAwayRuns: 5.2,
      projectedTotal: 8.1,
      projectedMargin: -2.3,
      homeWinProb: 0.31,
      awayWinProb: 0.69,
      homeRunLineCoverProb: 0.34,
      awayRunLineCoverProb: 0.66,
      overProb: 0.51,
      underProb: 0.49,
      homeStarterInnings: 5.4,
      awayStarterInnings: 6.1,
      modelLean: 'Away side lean',
      features: [],
    }

    const odds: OddsInput = {
      source: 'manual',
      homeMoneyline: 105,
      awayMoneyline: -115,
      runLine: 1.5,
      runLineHomeOdds: -150,
      runLineAwayOdds: 140,
      overUnder: 8.5,
      overOdds: -110,
      underOdds: -110,
    }

    const analysis = analyzeBetting(result, odds)

    expect(analysis.runLineRec).toBe('away -1.5')
  })
})
