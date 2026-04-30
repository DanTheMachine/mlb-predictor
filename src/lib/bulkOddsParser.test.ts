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
          runLine: 1.5,
          runLineAwayOdds: 155,
          runLineHomeOdds: -165,
          overUnder: 7,
          overOdds: -105,
          underOdds: -105,
        },
      },
    ])
  })

  it('keeps the cardinals as the away -1.5 side when washington is listed +1.5 at home', () => {
    const raw = `
Michael McGreevy/Miles Mikolas: CATV | NATV1:05 PM
ST. LOUIS CARDINALS
955
- 1 ½
+ 140
O 8 ½
Even
- 115
WASHINGTON NATIONALS
956
+ 1 ½
- 150
U 8 ½
- 110
+ 105
`

    expect(parseBulkOdds(raw)).toEqual([
      {
        awayAbbr: 'STL',
        homeAbbr: 'WSH',
        awayStarter: 'Michael McGreevy',
        homeStarter: 'Miles Mikolas',
        gameTime: '1:05 PM',
        odds: {
          source: 'manual',
          awayMoneyline: -115,
          homeMoneyline: 105,
          runLine: 1.5,
          runLineAwayOdds: 140,
          runLineHomeOdds: -150,
          overUnder: 8.5,
          overOdds: 100,
          underOdds: -110,
        },
      },
    ])
  })

  it('parses noisy browser-style capture text with inline tokens', () => {
    const raw = `
MLB Odds Board
ATLANTA BRAVES 901 + 1.5 - 170 O 8.5 - 108 - 135 LOS ANGELES DODGERS 902 - 1.5 + 145 U 8.5 - 112 + 122
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

  it('parses starter names from the header line before each game', () => {
    const raw = `
Aaron Nola/Chris Sale: BRVN | NSPA10:35 AM
PHILADELPHIA PHILLIES
951
+ 1 ½
- 125
O 8 ½
- 105
+ 155
ATLANTA BRAVES
952
- 1 ½
+ 115
U 8 ½
- 105
- 175
Connelly Early/Kyle Bradish: MASN | NSN+10:35 AM
BOSTON RED SOX
963
+ 1 ½
- 170
O 7 ½
- 105
+ 125
BALTIMORE ORIOLES
964
- 1 ½
+ 150
U 7 ½
- 105
- 135
`

    const games = parseBulkOdds(raw)
    expect(games[0]?.awayStarter).toBe('Aaron Nola')
    expect(games[0]?.homeStarter).toBe('Chris Sale')
    expect(games[1]?.awayStarter).toBe('Connelly Early')
    expect(games[1]?.homeStarter).toBe('Kyle Bradish')
  })

  it('handles multi-word names and names with punctuation in headers', () => {
    const raw = `
J.T. Ginn/Kumar Rocker: NSCA | RASN11:35 AM
OAKLAND ATHLETICS
971
+ 1 ½
- 185
O 8 ½
- 105
+ 105
TEXAS RANGERS
972
- 1 ½
+ 165
U 8 ½
- 105
- 115
Simeon Woods Richardson/Jesse Scholtens: TWTV | RATV10:40 AM
MINNESOTA TWINS
967
+ 1 ½
- 155
O 8 ½
- 110
+ 130
TAMPA BAY RAYS
968
- 1 ½
+ 145
U 8 ½
Even
- 140
`

    const games = parseBulkOdds(raw)
    expect(games[0]?.awayStarter).toBe('J.T. Ginn')
    expect(games[0]?.homeStarter).toBe('Kumar Rocker')
    expect(games[1]?.awayStarter).toBe('Simeon Woods Richardson')
    expect(games[1]?.homeStarter).toBe('Jesse Scholtens')
  })

  it('leaves starters undefined when game has no header or channel-only header', () => {
    const raw = `
PHILADELPHIA PHILLIES
951
+ 1 ½
- 125
O 8 ½
- 105
+ 155
ATLANTA BRAVES
952
- 1 ½
+ 115
U 8 ½
- 105
- 175
ROTV | SNY2:00 PM
COLORADO ROCKIES
000
+ 1 ½
- 130
O 7 ½
- 105
+ 160
NEW YORK METS
000
- 1 ½
+ 120
U 7 ½
- 105
- 180
`

    const games = parseBulkOdds(raw)
    expect(games[0]?.awayStarter).toBeUndefined()
    expect(games[0]?.homeStarter).toBeUndefined()
    expect(games[1]?.awayStarter).toBeUndefined()
    expect(games[1]?.homeStarter).toBeUndefined()
  })

  it('ignores extra labels between teams and market tokens', () => {
    const raw = `
Michael McGreevy/Miles Mikolas: CATV | NATV 1:05 PM
ST. LOUIS CARDINALS rotation 955 run line - 1 1/2 price + 140 total O 8 1/2 over EVEN ml - 115
WASHINGTON NATIONALS rotation 956 run line + 1 1/2 price - 150 total U 8 1/2 under - 110 ml + 105
`

    expect(parseBulkOdds(raw)).toEqual([
      {
        awayAbbr: 'STL',
        homeAbbr: 'WSH',
        odds: {
          source: 'manual',
          awayMoneyline: -115,
          homeMoneyline: 105,
          runLine: 1.5,
          runLineAwayOdds: 140,
          runLineHomeOdds: -150,
          overUnder: 8.5,
          overOdds: 100,
          underOdds: -110,
        },
      },
    ])
  })

  it('extracts game time from the header line', () => {
    const raw = `
Noah Cameron/Jeffrey Springs: RYTV | NSCA12:05 PM
KANSAS CITY ROYALS
963
+ 1 ½
- 185
O 9 ½
+ 105
Even
OAKLAND ATHLETICS
964
- 1 ½
+ 165
U 9 ½
- 115
- 110
`
    const [game] = parseBulkOdds(raw)
    expect(game?.gameTime).toBe('12:05 PM')
    expect(game?.awayStarter).toBe('Noah Cameron')
    expect(game?.homeStarter).toBe('Jeffrey Springs')
  })

  it('extracts game time when channel code runs into the digits (e.g. RSN14:40 PM → 4:40 PM)', () => {
    const raw = `
Kevin Gausman/Bailey Ober: TWTV | RSN14:40 PM
TORONTO BLUE JAYS
965
- 1 ½
+ 135
O 8
Even
- 120
MINNESOTA TWINS
966
+ 1 ½
- 145
U 8
- 110
+ 110
`
    const [game] = parseBulkOdds(raw)
    expect(game?.gameTime).toBe('4:40 PM')
  })

  it('extracts game time from channel-only header (no starters)', () => {
    const raw = `
MLBN | NSBA | NSPA2:35 PM
SAN FRANCISCO GIANTS
955
+ 1 ½
- 165
O 8
Even
+ 125
PHILADELPHIA PHILLIES
956
- 1 ½
+ 155
U 8
- 110
- 135
`
    const [game] = parseBulkOdds(raw)
    expect(game?.gameTime).toBe('2:35 PM')
    expect(game?.awayStarter).toBeUndefined()
    expect(game?.homeStarter).toBeUndefined()
  })

  it('returns gameTime undefined when no time appears in the header', () => {
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
    const [game] = parseBulkOdds(raw)
    expect(game?.gameTime).toBeUndefined()
  })

  it('parses both games of a doubleheader and assigns sequential game times', () => {
    const raw = `
Lance McCullers Jr./Brandon Young: MASN | SCHN1:05 PM
HOUSTON ASTROS
969
+ 1 ½
- 175
O 9 ½
Even
+ 110
BALTIMORE ORIOLES
970
- 1 ½
+ 155
U 9 ½
- 110
- 120
TBD/TBD: MASN | SCHN4:35 PM
HOUSTON ASTROS
971
+ 1 ½
- 160
O 9
- 105
+ 115
BALTIMORE ORIOLES
972
- 1 ½
+ 145
U 9
- 110
- 130
`
    const games = parseBulkOdds(raw)
    expect(games).toHaveLength(2)
    expect(games[0]?.awayAbbr).toBe('HOU')
    expect(games[0]?.homeAbbr).toBe('BAL')
    expect(games[0]?.gameTime).toBe('1:05 PM')
    expect(games[1]?.awayAbbr).toBe('HOU')
    expect(games[1]?.homeAbbr).toBe('BAL')
    expect(games[1]?.gameTime).toBe('4:35 PM')
  })
})
