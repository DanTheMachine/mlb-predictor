import { describe, expect, it } from 'vitest'

import { analyzeBetting } from './betting'
import { buildCompositeRecommendation } from './compositeRecommendation'
import { createDefaultBullpenWorkload, getDefaultStarter, predictGame, TEAMS } from './mlbModel'
import type { ScheduleRow } from './mlbTypes'

describe('buildCompositeRecommendation', () => {
  it('returns a scored recommendation when model edge is meaningful', () => {
    const row: ScheduleRow = {
      game: { awayTeam: 'CWS', homeTeam: 'LAD', gameTime: '7:10 PM' },
      awayStarter: getDefaultStarter('CWS'),
      homeStarter: getDefaultStarter('LAD'),
      starterLastUpdated: '2026-03-25T16:10:00.000Z',
      awayBullpenFatigue: 'Taxed' as const,
      homeBullpenFatigue: 'Fresh' as const,
      awayBullpenWorkload: createDefaultBullpenWorkload('Taxed'),
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayLineupConfidence: 'Projected' as const,
      homeLineupConfidence: 'Confirmed' as const,
      lineupLastUpdated: '2026-03-25T16:25:00.000Z',
      temperature: 78,
      windMph: 9,
      windDirection: 'Out' as const,
      weatherLastUpdated: '2026-03-25T16:20:00.000Z',
      availabilityNotes: [],
      recentForm: {
        away: { team: 'CWS', last10Record: '3-7', runsScoredPerGame: 3.2, runsAllowedPerGame: 5.6, bullpenTrend: 'overworked', lastUpdated: '2026-03-25T15:00:00.000Z' },
        home: { team: 'LAD', last10Record: '8-2', runsScoredPerGame: 5.9, runsAllowedPerGame: 3.7, bullpenTrend: 'steady', lastUpdated: '2026-03-25T15:00:00.000Z' },
      },
      sharpInput: {
        source: 'sample',
        lastUpdated: '2026-03-25T16:05:00.000Z',
        openingHomeMoneyline: -165,
        openingAwayMoneyline: 145,
        openingTotal: 8.5,
        moneylineHomeBetsPct: 44,
        moneylineHomeMoneyPct: 58,
        totalOverBetsPct: 62,
        totalOverMoneyPct: 55,
        steamLean: 'home',
        reverseLean: 'none',
      },
      compositeRecommendation: null,
      odds: {
        source: 'manual' as const,
        homeMoneyline: -155,
        awayMoneyline: 135,
        runLine: -1.5,
        runLineHomeOdds: 132,
        runLineAwayOdds: -158,
        overUnder: 8,
        overOdds: -110,
        underOdds: -110,
      },
      result: predictGame({
        homeTeam: TEAMS.LAD,
        awayTeam: TEAMS.CWS,
        homeStarter: getDefaultStarter('LAD'),
        awayStarter: getDefaultStarter('CWS'),
        gameType: 'Regular Season',
        temperature: 78,
        windMph: 9,
        windDirection: 'Out',
        homeBullpenFatigue: 'Fresh',
        awayBullpenFatigue: 'Taxed',
        homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
        awayBullpenWorkload: createDefaultBullpenWorkload('Taxed'),
        homeLineupConfidence: 'Confirmed',
        awayLineupConfidence: 'Projected',
      }),
    }

    const analysis = row.result ? analyzeBetting(row.result, row.odds) : null
    const composite = buildCompositeRecommendation(row, analysis)

    expect(composite.pass).toBe(false)
    expect(composite.tier).not.toBe('PASS')
    expect(composite.reasons.length).toBeGreaterThan(0)
  })
})
