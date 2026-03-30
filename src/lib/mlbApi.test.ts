import { afterEach, describe, expect, it, vi } from 'vitest'

import { extractLineupSnapshot, extractWeatherSnapshot, fetchCompletedGameResults, fetchLiveScheduleRows, normalizeMlbTeam, parseOddsFromEspnEvent, resolveLiveStarter } from './mlbApi'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mlbApi', () => {
  it('normalizes MLB live team objects into local abbreviations', () => {
    expect(normalizeMlbTeam({ id: 119 })).toBe('LAD')
    expect(normalizeMlbTeam({ abbreviation: 'AZ' })).toBe('ARI')
    expect(normalizeMlbTeam({ name: 'Boston Red Sox' })).toBe('BOS')
  })

  it('resolves a live probable starter while preserving team-specific baselines', () => {
    const starter = resolveLiveStarter('LAD', { fullName: 'Tyler Glasnow', pitchingHand: { code: 'R' } })
    const fallback = resolveLiveStarter('ATL', { fullName: 'Spencer Schwellenbach', pitchingHand: { code: 'R' } })

    expect(starter.name).toBe('Tyler Glasnow')
    expect(fallback.name).toBe('Spencer Schwellenbach')
    expect(fallback.team).toBe('ATL')
  })

  it('builds live schedule rows with weather and probable starters', async () => {
    const rows = await fetchLiveScheduleRows('2026-03-26', {
      scheduleFetcher: async () => ({
        dates: [
          {
            games: [
              {
                gamePk: 777777,
                gameDate: '2026-03-26T23:10:00Z',
                teams: {
                  away: {
                    team: { id: 144, abbreviation: 'ATL' },
                    probablePitcher: { fullName: 'Chris Sale', pitchingHand: { code: 'L' } },
                  },
                  home: {
                    team: { id: 119, abbreviation: 'LAD' },
                    probablePitcher: { fullName: 'Tyler Glasnow', pitchingHand: { code: 'R' } },
                  },
                },
              },
            ],
          },
        ],
      }),
      weatherFetcher: async () => ({
        temperature: 67,
        windMph: 12,
        windDirection: 'Cross',
        summary: 'windy conditions around 12 mph',
      }),
      lineupFetcher: async () => ({
        awayConfidence: 'Confirmed',
        homeConfidence: 'Projected',
        awayNote: 'Away lineup confirmed via MLB boxscore with 9 hitters listed.',
        homeNote: 'Home lineup not yet posted via MLB boxscore.',
      }),
      oddsFetcher: async () => ({
        'LAD-ATL': {
          source: 'espn',
          homeMoneyline: -148,
          awayMoneyline: 126,
          runLine: -1.5,
          runLineHomeOdds: 132,
          runLineAwayOdds: -156,
          overUnder: 8.5,
          overOdds: -108,
          underOdds: -112,
        },
      }),
    })

    expect(rows).toHaveLength(1)
    expect(rows[0]?.game.awayTeam).toBe('ATL')
    expect(rows[0]?.game.homeTeam).toBe('LAD')
    expect(rows[0]?.homeStarter.name).toBe('Tyler Glasnow')
    expect(rows[0]?.temperature).toBe(67)
    expect(rows[0]?.weatherLastUpdated).not.toBe('')
    expect(rows[0]?.awayLineupConfidence).toBe('Confirmed')
    expect(rows[0]?.odds.source).toBe('espn')
    expect(rows[0]?.odds.overUnder).toBe(8.5)
  })

  it('extracts the nearest weather hour for a first-pitch timestamp', () => {
    const snapshot = extractWeatherSnapshot(
      {
        hourly: {
          time: ['2026-03-26T15:00:00', '2026-03-26T16:00:00', '2026-03-26T17:00:00'],
          temperature_2m: [61, 64, 66],
          wind_speed_10m: [4, 11, 16],
          wind_direction_10m: [180, 90, 260],
          weather_code: [0, 0, 61],
        },
      },
      '2026-03-26T16:10:00Z',
      'LAD',
    )

    expect(snapshot).toEqual({
      temperature: 64,
      windMph: 11,
      windDirection: 'Cross',
      summary: 'temperate outdoor conditions',
    })
  })

  it('classifies wind relative to the home park orientation instead of a global compass bucket', () => {
    const snapshot = extractWeatherSnapshot(
      {
        hourly: {
          time: ['2026-03-26T23:00:00'],
          temperature_2m: [67],
          wind_speed_10m: [14],
          wind_direction_10m: [205],
          weather_code: [0],
        },
      },
      '2026-03-26T23:10:00Z',
      'LAD',
    )

    expect(snapshot).toEqual({
      temperature: 67,
      windMph: 14,
      windDirection: 'Out',
      summary: 'windy conditions around 14 mph',
    })
  })

  it('extracts lineup confirmation from MLB boxscore payloads', () => {
    const snapshot = extractLineupSnapshot({
      teams: {
        away: {
          batters: [101, 102, 103, 104, 105, 106, 107, 108, 109],
        },
        home: {
          players: {
            ID100: { battingOrder: '100' },
            ID101: { battingOrder: '200' },
            ID102: { battingOrder: '300' },
          },
        },
      },
    })

    expect(snapshot).toEqual({
      awayConfidence: 'Confirmed',
      homeConfidence: 'Thin',
      awayNote: 'Away lineup confirmed via MLB boxscore with 9 hitters listed.',
      homeNote: 'Home lineup only partially posted via MLB boxscore (3 hitters listed).',
    })
  })

  it('parses ESPN MLB odds events into the local odds model', () => {
    const parsed = parseOddsFromEspnEvent({
      competitions: [
        {
          competitors: [
            { homeAway: 'home', team: { abbreviation: 'LAD' } },
            { homeAway: 'away', team: { abbreviation: 'ATL' } },
          ],
          odds: [
            {
              moneyline: {
                home: { close: { odds: '-145' } },
                away: { close: { odds: '+125' } },
              },
              pointSpread: {
                home: { close: { line: '-1.5', odds: '+135' } },
                away: { close: { line: '+1.5', odds: '-160' } },
              },
              total: {
                over: { close: { line: '8.5', odds: '-108' } },
                under: { close: { odds: '-112' } },
              },
            },
          ],
        },
      ],
    })

    expect(parsed).toEqual({
      homeTeam: 'LAD',
      awayTeam: 'ATL',
      odds: {
        source: 'espn',
        homeMoneyline: -145,
        awayMoneyline: 125,
        runLine: -1.5,
        runLineHomeOdds: 135,
        runLineAwayOdds: -160,
        overUnder: 8.5,
        overOdds: -108,
        underOdds: -112,
      },
    })
  })

  it('uses officialDate for completed-game exports when late games cross midnight UTC', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        dates: [
          {
            games: [
              {
                gameDate: '2026-03-29T03:10:00Z',
                officialDate: '2026-03-28',
                status: {
                  abstractGameState: 'Final',
                  detailedState: 'Final',
                },
                teams: {
                  away: {
                    team: { id: 109, abbreviation: 'ARI' },
                    score: 2,
                  },
                  home: {
                    team: { id: 119, abbreviation: 'LAD' },
                    score: 3,
                  },
                },
              },
            ],
          },
        ],
      }),
    } as Response)

    const results = await fetchCompletedGameResults('2026-03-28')

    expect(results).toEqual([
      {
        date: '2026-03-28',
        away: 'ARI',
        home: 'LAD',
        awayScore: 2,
        homeScore: 3,
        lookupKey: '20260328LADARI',
      },
    ])
  })
})
