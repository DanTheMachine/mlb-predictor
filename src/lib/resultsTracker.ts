import type { ParsedPredictionRow, ParsedResultRow } from './modelEvaluation'

export type TrackerMarketSummary = {
  w: number
  l: number
  p: number
  pending: number
  roi: string
  pct: string
}

export type TrackerStats = {
  ml: TrackerMarketSummary
  rl: TrackerMarketSummary
  ou: TrackerMarketSummary
}

export type TrackedGameRow = ParsedPredictionRow & {
  resultRow: ParsedResultRow | null
  graded: boolean
  actualTotal?: number
  actualMargin?: number
  moneylineWin?: boolean | null
  moneylineUnits?: number | null
  runLineWin?: boolean | null
  runLinePush?: boolean | null
  runLineUnits?: number | null
  totalWin?: boolean | null
  totalPush?: boolean | null
  totalUnits?: number | null
}

function unitsFromAmericanOdds(odds: number | null): number {
  if (odds == null) return 0
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds)
}

export function gradeTrackedGames(predictions: ParsedPredictionRow[], results: ParsedResultRow[]): TrackedGameRow[] {
  const resultsByKey = new Map(results.map((row) => [row.lookupKey, row]))

  return predictions.map((prediction) => {
    const resultRow = resultsByKey.get(prediction.lookupKey) ?? null
    if (!resultRow) {
      return {
        ...prediction,
        resultRow: null,
        graded: false,
      }
    }

    const actualTotal = resultRow.homeScore + resultRow.awayScore
    const actualMargin = resultRow.homeScore - resultRow.awayScore

    let moneylineWin: boolean | null = null
    let moneylineUnits: number | null = null
    const moneylineRec = prediction.moneylineRec.trim().toUpperCase()
    if (moneylineRec && moneylineRec !== 'PASS') {
      const isHome = moneylineRec.includes('HOME')
      const odds = isHome ? prediction.homeML : prediction.awayML
      moneylineWin = isHome ? resultRow.homeScore > resultRow.awayScore : resultRow.awayScore > resultRow.homeScore
      moneylineUnits = moneylineWin ? unitsFromAmericanOdds(odds) : -1
    }

    let runLineWin: boolean | null = null
    let runLinePush: boolean | null = null
    let runLineUnits: number | null = null
    const runLineRec = prediction.runLineRec.trim().toUpperCase()
    if (runLineRec && runLineRec !== 'PASS' && prediction.runLine != null) {
      const isHome = runLineRec.startsWith('HOME')
      const odds = isHome ? prediction.runLineHomeOdds : prediction.runLineAwayOdds
      const coverDiff = isHome ? actualMargin + prediction.runLine : -actualMargin - prediction.runLine
      if (coverDiff > 0) {
        runLineWin = true
        runLinePush = false
        runLineUnits = unitsFromAmericanOdds(odds)
      } else if (coverDiff < 0) {
        runLineWin = false
        runLinePush = false
        runLineUnits = -1
      } else {
        runLineWin = null
        runLinePush = true
        runLineUnits = 0
      }
    }

    let totalWin: boolean | null = null
    let totalPush: boolean | null = null
    let totalUnits: number | null = null
    const totalRec = prediction.totalRec.trim().toUpperCase()
    if (totalRec && totalRec !== 'PASS' && prediction.marketTotal != null) {
      const odds = totalRec === 'OVER' ? prediction.overOdds : prediction.underOdds
      if (actualTotal > prediction.marketTotal) {
        totalWin = totalRec === 'OVER'
        totalPush = false
        totalUnits = totalWin ? unitsFromAmericanOdds(odds) : -1
      } else if (actualTotal < prediction.marketTotal) {
        totalWin = totalRec === 'UNDER'
        totalPush = false
        totalUnits = totalWin ? unitsFromAmericanOdds(odds) : -1
      } else {
        totalWin = null
        totalPush = true
        totalUnits = 0
      }
    }

    return {
      ...prediction,
      resultRow,
      graded: true,
      actualTotal,
      actualMargin,
      moneylineWin,
      moneylineUnits,
      runLineWin,
      runLinePush,
      runLineUnits,
      totalWin,
      totalPush,
      totalUnits,
    }
  })
}

export function summarizeTrackedGames(games: TrackedGameRow[]): TrackerStats {
  const summarize = (
    recKey: 'moneylineRec' | 'runLineRec' | 'totalRec',
    winKey: 'moneylineWin' | 'runLineWin' | 'totalWin',
    pushKey: 'runLinePush' | 'totalPush' | null,
    unitsKey: 'moneylineUnits' | 'runLineUnits' | 'totalUnits',
  ): TrackerMarketSummary => {
    const relevant = games.filter((row) => row[recKey].trim().toUpperCase() && row[recKey].trim().toUpperCase() !== 'PASS')
    const wins = relevant.filter((row) => row[winKey] === true).length
    const losses = relevant.filter((row) => row[winKey] === false).length
    const pushes = pushKey ? relevant.filter((row) => row[pushKey] === true).length : 0
    const pending = relevant.filter((row) => !row.graded).length
    const settled = wins + losses + pushes
    const roi = relevant.reduce((sum, row) => sum + (row[unitsKey] ?? 0), 0)

    return {
      w: wins,
      l: losses,
      p: pushes,
      pending,
      roi: roi.toFixed(2),
      pct: settled ? ((wins / settled) * 100).toFixed(1) : '-',
    }
  }

  return {
    ml: summarize('moneylineRec', 'moneylineWin', null, 'moneylineUnits'),
    rl: summarize('runLineRec', 'runLineWin', 'runLinePush', 'runLineUnits'),
    ou: summarize('totalRec', 'totalWin', 'totalPush', 'totalUnits'),
  }
}
