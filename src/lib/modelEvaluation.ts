export type ParsedPredictionRow = {
  date: string
  away: string
  home: string
  lookupKey: string
  awayRuns: number | null
  homeRuns: number | null
  projectedTotal: number | null
  moneylineRec: string
  moneylineEdgePct: number | null
  runLineRec: string
  runLineEdgePct: number | null
  totalRec: string
  totalEdgePct: number | null
  marketTotal: number | null
  homeML: number | null
  awayML: number | null
  runLine: number | null
  runLineHomeOdds: number | null
  runLineAwayOdds: number | null
  overOdds: number | null
  underOdds: number | null
}

export type ParsedResultRow = {
  date: string
  away: string
  home: string
  awayScore: number
  homeScore: number
  lookupKey: string
}

export type CalibrationThresholds = {
  moneylineEdgePct: number
  runLineEdgePct: number
  totalEdgePct: number
}

export type EvaluatedBetRow = {
  lookupKey: string
  date: string
  matchup: string
  betType: 'ML' | 'RL' | 'OU'
  recommendation: string
  odds: number | null
  edgePct: number | null
  result: 'WIN' | 'LOSS' | 'PUSH' | 'PENDING'
  units: number
}

export type EvaluationSummary = {
  totalBets: number
  wins: number
  losses: number
  pushes: number
  pending: number
  roiUnits: number
  winPct: string
}

export type EdgeBucketSummary = {
  label: string
  totalBets: number
  settledBets: number
  wins: number
  losses: number
  pushes: number
  roiUnits: number
  winPct: string
}

export type EvaluationReport = {
  thresholds: CalibrationThresholds
  moneyline: EvaluationSummary
  runLine: EvaluationSummary
  totals: EvaluationSummary
  edgeBuckets: {
    ML: EdgeBucketSummary[]
    RL: EdgeBucketSummary[]
    OU: EdgeBucketSummary[]
  }
  rows: EvaluatedBetRow[]
}

export const DEFAULT_THRESHOLDS: CalibrationThresholds = {
  moneylineEdgePct: 2.5,
  runLineEdgePct: 3,
  totalEdgePct: 3,
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell)
      if (row.some((value) => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  row.push(cell)
  if (row.some((value) => value.trim() !== '')) rows.push(row)
  return rows
}

function columnIndex(headers: string[], name: string) {
  return headers.findIndex((header) => header === name.toLowerCase())
}

function columnIndexAny(headers: string[], names: string[]) {
  return names.map((name) => columnIndex(headers, name)).find((index) => index >= 0) ?? -1
}

function parseNumber(value: string): number | null {
  const cleaned = value.trim().replace(/[%+]/g, '')
  if (!cleaned || cleaned === 'PASS' || cleaned === '-') return null
  const parsed = Number.parseFloat(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function unitsFromAmericanOdds(odds: number | null): number {
  if (odds == null) return 0
  return odds > 0 ? odds / 100 : 100 / Math.abs(odds)
}

function summarize(rows: EvaluatedBetRow[], betType: EvaluatedBetRow['betType']): EvaluationSummary {
  const filtered = rows.filter((row) => row.betType === betType)
  const wins = filtered.filter((row) => row.result === 'WIN').length
  const losses = filtered.filter((row) => row.result === 'LOSS').length
  const pushes = filtered.filter((row) => row.result === 'PUSH').length
  const pending = filtered.filter((row) => row.result === 'PENDING').length
  const settled = wins + losses + pushes
  return {
    totalBets: filtered.length,
    wins,
    losses,
    pushes,
    pending,
    roiUnits: filtered.reduce((sum, row) => sum + row.units, 0),
    winPct: settled > 0 ? ((wins / settled) * 100).toFixed(1) : '-',
  }
}

export function parsePredictionsCsv(text: string): ParsedPredictionRow[] {
  const rows = parseCsv(text.trim())
  if (rows.length < 2) throw new Error('Predictions CSV needs a header row and at least one data row.')
  const headers = rows[0]?.map((value) => value.trim().toLowerCase()) ?? []

  const idx = {
    date: columnIndex(headers, 'Date'),
    away: columnIndex(headers, 'Away'),
    home: columnIndex(headers, 'Home'),
    lookupKey: columnIndex(headers, 'LookupKey'),
    awayRuns: columnIndex(headers, 'AwayRuns'),
    homeRuns: columnIndex(headers, 'HomeRuns'),
    projectedTotal: columnIndex(headers, 'Total'),
    moneylineRec: columnIndex(headers, 'MoneylineRec'),
    moneylineEdgePct: columnIndex(headers, 'MoneylineEdgePct'),
    runLineRec: columnIndex(headers, 'RunLineRec'),
    runLineEdgePct: columnIndex(headers, 'RunLineEdgePct'),
    totalRec: columnIndex(headers, 'TotalRec'),
    totalEdgePct: columnIndex(headers, 'TotalEdgePct'),
    marketTotal: columnIndex(headers, 'MarketTotal'),
    homeML: columnIndex(headers, 'HomeML'),
    awayML: columnIndex(headers, 'AwayML'),
    runLine: columnIndex(headers, 'RunLine'),
    runLineHomeOdds: columnIndex(headers, 'RunLineHomeOdds'),
    runLineAwayOdds: columnIndex(headers, 'RunLineAwayOdds'),
    overOdds: columnIndex(headers, 'OverOdds'),
    underOdds: columnIndex(headers, 'UnderOdds'),
  }

  if ([idx.date, idx.away, idx.home, idx.lookupKey].some((value) => value < 0)) {
    throw new Error('Predictions CSV is missing required Date/Away/Home/LookupKey columns.')
  }

  return rows
    .slice(1)
    .map((columns) => {
      const get = (index: number) => (index >= 0 ? (columns[index] ?? '').trim() : '')
      return {
        date: get(idx.date),
        away: get(idx.away).toUpperCase(),
        home: get(idx.home).toUpperCase(),
        lookupKey: get(idx.lookupKey),
        awayRuns: parseNumber(get(idx.awayRuns)),
        homeRuns: parseNumber(get(idx.homeRuns)),
        projectedTotal: parseNumber(get(idx.projectedTotal)),
        moneylineRec: get(idx.moneylineRec),
        moneylineEdgePct: parseNumber(get(idx.moneylineEdgePct)),
        runLineRec: get(idx.runLineRec),
        runLineEdgePct: parseNumber(get(idx.runLineEdgePct)),
        totalRec: get(idx.totalRec),
        totalEdgePct: parseNumber(get(idx.totalEdgePct)),
        marketTotal: parseNumber(get(idx.marketTotal)),
        homeML: parseNumber(get(idx.homeML)),
        awayML: parseNumber(get(idx.awayML)),
        runLine: parseNumber(get(idx.runLine)),
        runLineHomeOdds: parseNumber(get(idx.runLineHomeOdds)),
        runLineAwayOdds: parseNumber(get(idx.runLineAwayOdds)),
        overOdds: parseNumber(get(idx.overOdds)),
        underOdds: parseNumber(get(idx.underOdds)),
      }
    })
    .filter((row) => row.date && row.home && row.away && row.lookupKey)
}

export function parseResultsCsv(text: string): ParsedResultRow[] {
  const rows = parseCsv(text.trim())
  if (rows.length < 2) throw new Error('Results CSV needs a header row and at least one data row.')
  const headers = rows[0]?.map((value) => value.trim().toLowerCase()) ?? []

  const idx = {
    date: columnIndex(headers, 'Date'),
    away: columnIndex(headers, 'Away'),
    home: columnIndex(headers, 'Home'),
    awayScore: columnIndexAny(headers, ['AwayScore', 'Away Score']),
    homeScore: columnIndexAny(headers, ['HomeScore', 'Home Score']),
    lookupKey: columnIndex(headers, 'LookupKey'),
  }

  if ([idx.date, idx.away, idx.home, idx.awayScore, idx.homeScore].some((value) => value < 0)) {
    throw new Error('Results CSV is missing required Date/Away/Home/AwayScore/HomeScore columns.')
  }

  return rows
    .slice(1)
    .map((columns) => {
      const get = (index: number) => (index >= 0 ? (columns[index] ?? '').trim() : '')
      const date = get(idx.date)
      const away = get(idx.away).toUpperCase()
      const home = get(idx.home).toUpperCase()
      return {
        date,
        away,
        home,
        awayScore: Number.parseInt(get(idx.awayScore), 10),
        homeScore: Number.parseInt(get(idx.homeScore), 10),
        lookupKey: get(idx.lookupKey) || `${date.replaceAll('-', '')}${home}${away}`,
      }
    })
    .filter((row) => row.date && row.home && row.away && Number.isFinite(row.homeScore) && Number.isFinite(row.awayScore))
}

export function evaluatePredictions(
  predictions: ParsedPredictionRow[],
  results: ParsedResultRow[],
  thresholds: CalibrationThresholds = DEFAULT_THRESHOLDS,
): EvaluationReport {
  const resultsByKey = new Map(results.map((row) => [row.lookupKey, row]))
  const evaluatedRows: EvaluatedBetRow[] = []

  for (const prediction of predictions) {
    const result = resultsByKey.get(prediction.lookupKey)
    const matchup = `${prediction.away} at ${prediction.home}`

    if (
      prediction.moneylineRec &&
      prediction.moneylineRec.toUpperCase() !== 'PASS' &&
      (prediction.moneylineEdgePct ?? 0) >= thresholds.moneylineEdgePct
    ) {
      const isHome = prediction.moneylineRec.toUpperCase().includes('HOME')
      const odds = isHome ? prediction.homeML : prediction.awayML
      evaluatedRows.push(
        !result
          ? pendingRow(prediction, matchup, 'ML', prediction.moneylineRec, odds, prediction.moneylineEdgePct)
          : {
              lookupKey: prediction.lookupKey,
              date: prediction.date,
              matchup,
              betType: 'ML',
              recommendation: prediction.moneylineRec,
              odds,
              edgePct: prediction.moneylineEdgePct,
              result:
                (isHome && result.homeScore > result.awayScore) || (!isHome && result.awayScore > result.homeScore) ? 'WIN' : 'LOSS',
              units:
                (isHome && result.homeScore > result.awayScore) || (!isHome && result.awayScore > result.homeScore)
                  ? unitsFromAmericanOdds(odds)
                  : -1,
            },
      )
    }

    if (
      prediction.runLineRec &&
      prediction.runLineRec.toUpperCase() !== 'PASS' &&
      (prediction.runLineEdgePct ?? 0) >= thresholds.runLineEdgePct
    ) {
      const isHome = prediction.runLineRec.toUpperCase().startsWith('HOME')
      const odds = isHome ? prediction.runLineHomeOdds : prediction.runLineAwayOdds
      if (!result || prediction.runLine == null) {
        evaluatedRows.push(pendingRow(prediction, matchup, 'RL', prediction.runLineRec, odds, prediction.runLineEdgePct))
      } else {
        const diff = result.homeScore - result.awayScore
        const coverDiff = isHome ? diff + prediction.runLine : -diff - prediction.runLine
        const outcome = coverDiff > 0 ? 'WIN' : coverDiff < 0 ? 'LOSS' : 'PUSH'
        evaluatedRows.push({
          lookupKey: prediction.lookupKey,
          date: prediction.date,
          matchup,
          betType: 'RL',
          recommendation: prediction.runLineRec,
          odds,
          edgePct: prediction.runLineEdgePct,
          result: outcome,
          units: outcome === 'WIN' ? unitsFromAmericanOdds(odds) : outcome === 'LOSS' ? -1 : 0,
        })
      }
    }

    if (
      prediction.totalRec &&
      prediction.totalRec.toUpperCase() !== 'PASS' &&
      (prediction.totalEdgePct ?? 0) >= thresholds.totalEdgePct
    ) {
      const isOver = prediction.totalRec.toUpperCase() === 'OVER'
      const odds = isOver ? prediction.overOdds : prediction.underOdds
      if (!result || prediction.marketTotal == null) {
        evaluatedRows.push(pendingRow(prediction, matchup, 'OU', prediction.totalRec, odds, prediction.totalEdgePct))
      } else {
        const total = result.homeScore + result.awayScore
        const outcome = isOver
          ? total > prediction.marketTotal
            ? 'WIN'
            : total < prediction.marketTotal
              ? 'LOSS'
              : 'PUSH'
          : total < prediction.marketTotal
            ? 'WIN'
            : total > prediction.marketTotal
              ? 'LOSS'
              : 'PUSH'
        evaluatedRows.push({
          lookupKey: prediction.lookupKey,
          date: prediction.date,
          matchup,
          betType: 'OU',
          recommendation: prediction.totalRec,
          odds,
          edgePct: prediction.totalEdgePct,
          result: outcome,
          units: outcome === 'WIN' ? unitsFromAmericanOdds(odds) : outcome === 'LOSS' ? -1 : 0,
        })
      }
    }
  }

  return {
    thresholds,
    moneyline: summarize(evaluatedRows, 'ML'),
    runLine: summarize(evaluatedRows, 'RL'),
    totals: summarize(evaluatedRows, 'OU'),
    edgeBuckets: {
      ML: buildEdgeBuckets(evaluatedRows, 'ML'),
      RL: buildEdgeBuckets(evaluatedRows, 'RL'),
      OU: buildEdgeBuckets(evaluatedRows, 'OU'),
    },
    rows: evaluatedRows.sort((a, b) => `${b.date}${b.lookupKey}`.localeCompare(`${a.date}${a.lookupKey}`)),
  }
}

function pendingRow(
  prediction: ParsedPredictionRow,
  matchup: string,
  betType: EvaluatedBetRow['betType'],
  recommendation: string,
  odds: number | null,
  edgePct: number | null,
): EvaluatedBetRow {
  return {
    lookupKey: prediction.lookupKey,
    date: prediction.date,
    matchup,
    betType,
    recommendation,
    odds,
    edgePct,
    result: 'PENDING',
    units: 0,
  }
}

function buildEdgeBuckets(rows: EvaluatedBetRow[], betType: EvaluatedBetRow['betType']): EdgeBucketSummary[] {
  const buckets = [
    { label: '3-4.9%', min: 3, max: 5 },
    { label: '5-7.9%', min: 5, max: 8 },
    { label: '8%+', min: 8, max: Number.POSITIVE_INFINITY },
  ]

  return buckets.map(({ label, min, max }) => {
    const bucketRows = rows.filter((row) => row.betType === betType && row.edgePct != null && row.edgePct >= min && row.edgePct < max)
    const wins = bucketRows.filter((row) => row.result === 'WIN').length
    const losses = bucketRows.filter((row) => row.result === 'LOSS').length
    const pushes = bucketRows.filter((row) => row.result === 'PUSH').length
    const settledBets = wins + losses + pushes
    return {
      label,
      totalBets: bucketRows.length,
      settledBets,
      wins,
      losses,
      pushes,
      roiUnits: bucketRows.reduce((sum, row) => sum + row.units, 0),
      winPct: settledBets > 0 ? ((wins / settledBets) * 100).toFixed(1) : '-',
    }
  })
}
