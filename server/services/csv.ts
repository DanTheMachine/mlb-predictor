import { TEAMS } from '../../src/lib/mlbModel.js'
import type { TeamAbbr } from '../../src/lib/mlbTypes.js'
import type { AutomationPredictionRow } from './mlbAutomation.js'

export type AutomationResultRow = {
  date: string
  home: TeamAbbr
  away: TeamAbbr
  homeScore: number
  awayScore: number
  lookupKey: string
}

function csvEscape(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function teamLabel(team: TeamAbbr) {
  return `${team} ${TEAMS[team].name}`
}

export function buildPredictionsCsv(rows: AutomationPredictionRow[]) {
  const header = [
    'Date',
    'GameTime',
    'Away',
    'Home',
    'AwayStarter',
    'HomeStarter',
    'AwayRuns',
    'HomeRuns',
    'Total',
    'Margin',
    'HomeWinProb',
    'AwayWinProb',
    'MoneylineRec',
    'MoneylineEdgePct',
    'RunLineRec',
    'RunLineEdgePct',
    'TotalRec',
    'TotalEdgePct',
    'MarketTotal',
    'HomeML',
    'AwayML',
    'RunLine',
    'RunLineHomeOdds',
    'RunLineAwayOdds',
    'OverOdds',
    'UnderOdds',
    'AwayLineupConfidence',
    'HomeLineupConfidence',
    'StarterFreshness',
    'WeatherFreshness',
    'SharpFreshness',
    'CompositeMarket',
    'CompositePick',
    'CompositeScore',
    'CompositeTier',
    'CompositeReasons',
    'LookupKey',
  ]

  const lines = rows.map((row) =>
    [
      row.date,
      row.gameTime,
      teamLabel(row.awayTeam),
      teamLabel(row.homeTeam),
      row.awayStarter,
      row.homeStarter,
      row.awayRuns.toFixed(2),
      row.homeRuns.toFixed(2),
      row.total.toFixed(2),
      row.margin.toFixed(2),
      (row.homeWinProb * 100).toFixed(1),
      (row.awayWinProb * 100).toFixed(1),
      row.moneylineRec,
      row.moneylineEdgePct.toFixed(1),
      row.runLineRec,
      row.runLineEdgePct.toFixed(1),
      row.totalRec,
      row.totalEdgePct.toFixed(1),
      row.marketTotal.toFixed(1),
      row.homeML,
      row.awayML,
      row.runLine,
      row.runLineHomeOdds,
      row.runLineAwayOdds,
      row.overOdds,
      row.underOdds,
      row.awayLineupConfidence,
      row.homeLineupConfidence,
      row.starterFreshness,
      row.weatherFreshness,
      row.sharpFreshness,
      row.compositeMarket,
      row.compositePick,
      row.compositeScore.toFixed(1),
      row.compositeTier,
      row.compositeReasons.join(' | '),
      row.lookupKey,
    ]
      .map(csvEscape)
      .join(','),
  )

  return [header.map(csvEscape).join(','), ...lines].join('\n')
}

export function buildResultsCsv(rows: AutomationResultRow[]) {
  const header = ['Date', 'Home', 'Away', 'Home Score', 'Away Score', 'Winner', 'Total', 'LookupKey']
  const lines = rows.map((row) =>
    [
      row.date,
      row.home,
      row.away,
      row.homeScore,
      row.awayScore,
      row.homeScore > row.awayScore ? row.home : row.away,
      row.homeScore + row.awayScore,
      row.lookupKey,
    ]
      .map(csvEscape)
      .join(','),
  )

  return [header.map(csvEscape).join(','), ...lines].join('\n')
}
