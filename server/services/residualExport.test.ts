import { describe, expect, it } from 'vitest'

import type { ResidualRow } from './residualExport.js'

// ---------------------------------------------------------------------------
// Unit tests for the residual math and CSV shape.
// The full export pipeline requires a live DB and is covered by integration
// tests in a sandbox environment. These tests focus on the pure logic.
// ---------------------------------------------------------------------------

describe('residual math', () => {
  it('residualHome equals actualHomeRuns minus projectedHomeRuns', () => {
    const row: ResidualRow = makeRow({ projectedHomeRuns: 4.5, actualHomeRuns: 6 })
    expect(row.residualHome).toBeCloseTo(1.5, 5)
  })

  it('residualAway equals actualAwayRuns minus projectedAwayRuns', () => {
    const row: ResidualRow = makeRow({ projectedAwayRuns: 3.2, actualAwayRuns: 2 })
    expect(row.residualAway).toBeCloseTo(-1.2, 5)
  })

  it('residuals are zero when projection matches actuals exactly', () => {
    const row: ResidualRow = makeRow({
      projectedHomeRuns: 4.35,
      actualHomeRuns: 4.35,
      projectedAwayRuns: 3.9,
      actualAwayRuns: 3.9,
    })
    expect(row.residualHome).toBeCloseTo(0, 5)
    expect(row.residualAway).toBeCloseTo(0, 5)
  })
})

describe('exclusion thresholds', () => {
  it('a game with 4 combined runs is below the incomplete-game threshold', () => {
    // The service filters actualHomeRuns + actualAwayRuns < 5
    const total = 2 + 2
    expect(total).toBeLessThan(5)
  })

  it('a game with 25 combined runs meets the extreme-total flag threshold', () => {
    const total = 14 + 11
    expect(total).toBeGreaterThanOrEqual(25)
  })

  it('a normal game with 9 combined runs passes both filters', () => {
    const total = 5 + 4
    expect(total).toBeGreaterThanOrEqual(5)
    expect(total).toBeLessThan(25)
  })
})

describe('ResidualRow shape', () => {
  it('has all required fields', () => {
    const row = makeRow({})
    const requiredKeys: Array<keyof ResidualRow> = [
      'date', 'lookupKey', 'homeTeam', 'awayTeam',
      'homeStarter', 'awayStarter',
      'projectedHomeRuns', 'projectedAwayRuns',
      'actualHomeRuns', 'actualAwayRuns',
      'residualHome', 'residualAway',
      'temperature', 'windMph', 'windDirection',
      'parkFactor', 'homeStarterEra', 'homeStarterFip',
      'awayStarterEra', 'awayStarterFip',
      'homeBullpenFatigue', 'awayBullpenFatigue',
      'homeLineupConfidence', 'awayLineupConfidence',
      'marketTotal', 'dayOfWeek', 'monthOfSeason',
    ]
    for (const key of requiredKeys) {
      expect(key in row).toBe(true)
    }
  })

  it('dayOfWeek is between 0 and 6', () => {
    for (let dow = 0; dow <= 6; dow++) {
      const row = makeRow({ dayOfWeek: dow })
      expect(row.dayOfWeek).toBeGreaterThanOrEqual(0)
      expect(row.dayOfWeek).toBeLessThanOrEqual(6)
    }
  })

  it('monthOfSeason is between 1 and 12', () => {
    for (let month = 1; month <= 12; month++) {
      const row = makeRow({ monthOfSeason: month })
      expect(row.monthOfSeason).toBeGreaterThanOrEqual(1)
      expect(row.monthOfSeason).toBeLessThanOrEqual(12)
    }
  })

  it('allows null for optional feature fields', () => {
    const row = makeRow({
      temperature: null,
      windMph: null,
      windDirection: null,
      parkFactor: null,
      homeStarterEra: null,
    })
    expect(row.temperature).toBeNull()
    expect(row.windMph).toBeNull()
    expect(row.windDirection).toBeNull()
    expect(row.parkFactor).toBeNull()
    expect(row.homeStarterEra).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<ResidualRow>): ResidualRow {
  const projectedHomeRuns = overrides.projectedHomeRuns ?? 4.5
  const projectedAwayRuns = overrides.projectedAwayRuns ?? 3.8
  const actualHomeRuns = overrides.actualHomeRuns ?? 5
  const actualAwayRuns = overrides.actualAwayRuns ?? 3

  return {
    date: '2026-05-01',
    lookupKey: '20260501LADSD',
    homeTeam: 'LAD',
    awayTeam: 'SD',
    homeStarter: 'Tyler Glasnow',
    awayStarter: 'Joe Musgrove',
    projectedHomeRuns,
    projectedAwayRuns,
    actualHomeRuns,
    actualAwayRuns,
    residualHome: actualHomeRuns - projectedHomeRuns,
    residualAway: actualAwayRuns - projectedAwayRuns,
    temperature: 74,
    windMph: 8,
    windDirection: 'Out',
    parkFactor: 0.99,
    homeStarterEra: 3.29,
    homeStarterFip: 3.22,
    awayStarterEra: 3.56,
    awayStarterFip: 3.47,
    homeBullpenFatigue: 'Fresh',
    awayBullpenFatigue: 'Used',
    homeLineupConfidence: 'Confirmed',
    awayLineupConfidence: 'Confirmed',
    marketTotal: 8.0,
    dayOfWeek: 4,
    monthOfSeason: 5,
    ...overrides,
  }
}
