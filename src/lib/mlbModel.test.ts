import { describe, expect, it } from 'vitest'

import { createDefaultBullpenWorkload, getDefaultStarter, getStartersForTeam, predictGame, TEAMS } from './mlbModel'

describe('predictGame', () => {
  it('projects a stronger home team as a favorite in a good run environment', () => {
    const result = predictGame({
      homeTeam: TEAMS.LAD,
      awayTeam: TEAMS.CWS,
      homeStarter: getDefaultStarter('LAD'),
      awayStarter: getDefaultStarter('CWS'),
      gameType: 'Regular Season',
      temperature: 82,
      windMph: 10,
      windDirection: 'Out',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Taxed',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Taxed'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Projected',
    })

    expect(result.projectedHomeRuns).toBeGreaterThan(result.projectedAwayRuns)
    expect(result.homeWinProb).toBeGreaterThan(0.5)
    expect(result.projectedTotal).toBeGreaterThan(8)
  })

  it('suppresses scoring in cooler inward-wind conditions', () => {
    const hitterWeather = predictGame({
      homeTeam: TEAMS.TEX,
      awayTeam: TEAMS.BOS,
      homeStarter: getDefaultStarter('TEX'),
      awayStarter: getDefaultStarter('BOS'),
      gameType: 'Regular Season',
      temperature: 88,
      windMph: 12,
      windDirection: 'Out',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    const pitcherWeather = predictGame({
      homeTeam: TEAMS.TEX,
      awayTeam: TEAMS.BOS,
      homeStarter: getDefaultStarter('TEX'),
      awayStarter: getDefaultStarter('BOS'),
      gameType: 'Regular Season',
      temperature: 52,
      windMph: 12,
      windDirection: 'In',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    expect(hitterWeather.projectedTotal).toBeGreaterThan(pitcherWeather.projectedTotal)
  })

  it('changes starter outlook when a weaker probable starter is selected', () => {
    const dodgersStarters = getStartersForTeam('LAD')
    const dodgersAce = dodgersStarters[0]
    const dodgersBackEnd = dodgersStarters[2]

    expect(dodgersAce).toBeDefined()
    expect(dodgersBackEnd).toBeDefined()

    const aceResult = predictGame({
      homeTeam: TEAMS.LAD,
      awayTeam: TEAMS.SD,
      homeStarter: dodgersAce!,
      awayStarter: getDefaultStarter('SD'),
      gameType: 'Regular Season',
      temperature: 70,
      windMph: 4,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    const backEndResult = predictGame({
      homeTeam: TEAMS.LAD,
      awayTeam: TEAMS.SD,
      homeStarter: dodgersBackEnd!,
      awayStarter: getDefaultStarter('SD'),
      gameType: 'Regular Season',
      temperature: 70,
      windMph: 4,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    expect(backEndResult.projectedAwayRuns).toBeGreaterThan(aceResult.projectedAwayRuns)
  })

  it('returns homeCalc and awayCalc with all required RunCalcSteps fields', () => {
    const result = predictGame({
      homeTeam: TEAMS.NYY,
      awayTeam: TEAMS.BOS,
      homeStarter: getDefaultStarter('NYY'),
      awayStarter: getDefaultStarter('BOS'),
      gameType: 'Regular Season',
      temperature: 72,
      windMph: 5,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    const requiredKeys: Array<keyof typeof result.homeCalc> = [
      'leagueAvg', 'splitIndex', 'styleAdj', 'starterFactor', 'starterShare',
      'bullpenFactor', 'blendedPrevention', 'defenseAdj', 'parkFactor',
      'weather', 'lineupAdj', 'playoffAdj', 'projected',
    ]

    for (const key of requiredKeys) {
      expect(typeof result.homeCalc[key]).toBe('number')
      expect(typeof result.awayCalc[key]).toBe('number')
    }

    // awayCalc.projected matches projectedAwayRuns (no post-processing on away runs)
    expect(result.awayCalc.projected).toBeCloseTo(result.projectedAwayRuns, 1)
    // homeCalc.projected is the pre-home-field-bonus value; projectedHomeRuns adds +0.18 afterward
    expect(result.homeCalc.projected).toBeCloseTo(result.projectedHomeRuns - 0.18, 1)

    // Regular season — playoff adj must be exactly 1
    expect(result.homeCalc.playoffAdj).toBe(1)
    expect(result.awayCalc.playoffAdj).toBe(1)

    // starterShare must be between 0 and 1
    expect(result.homeCalc.starterShare).toBeGreaterThan(0)
    expect(result.homeCalc.starterShare).toBeLessThan(1)
  })

  it('sets playoffAdj below 1.0 in postseason games', () => {
    const regular = predictGame({
      homeTeam: TEAMS.LAD,
      awayTeam: TEAMS.ATL,
      homeStarter: getDefaultStarter('LAD'),
      awayStarter: getDefaultStarter('ATL'),
      gameType: 'Regular Season',
      temperature: 72,
      windMph: 5,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    const postseason = predictGame({
      homeTeam: TEAMS.LAD,
      awayTeam: TEAMS.ATL,
      homeStarter: getDefaultStarter('LAD'),
      awayStarter: getDefaultStarter('ATL'),
      gameType: 'Postseason',
      temperature: 72,
      windMph: 5,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    expect(postseason.homeCalc.playoffAdj).toBeLessThan(1)
    expect(postseason.projectedTotal).toBeLessThan(regular.projectedTotal)
  })

  it('penalizes heavily worked bullpens', () => {
    const freshBullpen = predictGame({
      homeTeam: TEAMS.SEA,
      awayTeam: TEAMS.HOU,
      homeStarter: getDefaultStarter('SEA'),
      awayStarter: getDefaultStarter('HOU'),
      gameType: 'Regular Season',
      temperature: 68,
      windMph: 3,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Fresh',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: { last3DaysPitchCount: 42, highLeverageUsage: 1, closerAvailable: true },
      awayBullpenWorkload: { last3DaysPitchCount: 42, highLeverageUsage: 1, closerAvailable: true },
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    const taxedBullpen = predictGame({
      homeTeam: TEAMS.SEA,
      awayTeam: TEAMS.HOU,
      homeStarter: getDefaultStarter('SEA'),
      awayStarter: getDefaultStarter('HOU'),
      gameType: 'Regular Season',
      temperature: 68,
      windMph: 3,
      windDirection: 'Neutral',
      homeBullpenFatigue: 'Taxed',
      awayBullpenFatigue: 'Fresh',
      homeBullpenWorkload: { last3DaysPitchCount: 112, highLeverageUsage: 4, closerAvailable: false },
      awayBullpenWorkload: { last3DaysPitchCount: 42, highLeverageUsage: 1, closerAvailable: true },
      homeLineupConfidence: 'Confirmed',
      awayLineupConfidence: 'Confirmed',
    })

    expect(taxedBullpen.projectedAwayRuns).toBeGreaterThan(freshBullpen.projectedAwayRuns)
  })
})
