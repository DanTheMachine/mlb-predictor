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
    expect(result.homeWinProb).toBeGreaterThan(0.6)
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
