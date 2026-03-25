import { describe, expect, it } from 'vitest'

import { parseBulkOdds } from './bulkOddsParser'

describe('parseBulkOdds', () => {
  it('parses a standard MLB sportsbook block', () => {
    const raw = `
ATLANTA BRAVES
901
+ 1.5
- 170
O 8.5
- 108
- 135
LOS ANGELES DODGERS
902
- 1.5
+ 145
U 8.5
- 112
+ 122
`

    expect(parseBulkOdds(raw)).toEqual([
      {
        awayAbbr: 'ATL',
        homeAbbr: 'LAD',
        odds: {
          source: 'manual',
          awayMoneyline: -135,
          homeMoneyline: 122,
          runLine: -1.5,
          runLineAwayOdds: -170,
          runLineHomeOdds: 145,
          overUnder: 8.5,
          overOdds: -108,
          underOdds: -112,
        },
      },
    ])
  })

  it('supports aliases and even money', () => {
    const raw = `
YANKEES
751
+ 1Â½
- 160
O 9Â½
EVEN
- 130
BOSTON
752
- 1Â½
+ 140
U 9Â½
- 120
+ 118
`

    const [game] = parseBulkOdds(raw)
    expect(game?.awayAbbr).toBe('NYY')
    expect(game?.homeAbbr).toBe('BOS')
    expect(game?.odds.overOdds).toBe(100)
    expect(game?.odds.overUnder).toBe(9.5)
  })

  it('throws a helpful error when the paste lacks team names', () => {
    expect(() => parseBulkOdds('bad paste')).toThrow(/recognizable MLB team names/i)
  })

  it('parses the ny yankees style paste format used in sportsbook sheets', () => {
    const raw = `
NY YANKEES
987
- 1 ½
+ 155
O 7
- 105
- 115
SAN FRANCISCO
988
+ 1 ½
- 165
U 7
- 105
+ 105
`

    expect(parseBulkOdds(raw)).toEqual([
      {
        awayAbbr: 'NYY',
        homeAbbr: 'SF',
        odds: {
          source: 'manual',
          awayMoneyline: -115,
          homeMoneyline: 105,
          runLine: -1.5,
          runLineAwayOdds: 155,
          runLineHomeOdds: -165,
          overUnder: 7,
          overOdds: -105,
          underOdds: -105,
        },
      },
    ])
  })
})
