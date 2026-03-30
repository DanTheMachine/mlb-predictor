import type { BettingAnalysis, CompositeRecommendation, ScheduleRow } from './mlbTypes'

export type CompositeRecommendationSet = {
  ML: CompositeRecommendation
  RL: CompositeRecommendation
  OU: CompositeRecommendation
}

type CompositeMarket = keyof CompositeRecommendationSet

export function buildCompositeRecommendations(row: ScheduleRow, analysis: BettingAnalysis | null): CompositeRecommendationSet {
  return {
    ML: buildMarketCompositeRecommendation('ML', row, analysis),
    RL: buildMarketCompositeRecommendation('RL', row, analysis),
    OU: buildMarketCompositeRecommendation('OU', row, analysis),
  }
}

export function buildCompositeRecommendation(row: ScheduleRow, analysis: BettingAnalysis | null): CompositeRecommendation {
  const recommendations = Object.values(buildCompositeRecommendations(row, analysis))
  const bestActive = recommendations
    .filter((recommendation) => !recommendation.pass)
    .sort((a, b) => b.score - a.score)[0]

  if (bestActive) return bestActive

  return recommendations.sort((a, b) => b.score - a.score)[0] ?? passRecommendation(['Awaiting simulation'])
}

function buildMarketCompositeRecommendation(
  market: CompositeMarket,
  row: ScheduleRow,
  analysis: BettingAnalysis | null,
): CompositeRecommendation {
  if (!analysis || !row.result) {
    return passRecommendation(['Awaiting simulation'], market)
  }

  const marketCandidate = marketCandidateFor(market, analysis)
  if (marketCandidate.score < 2.5 || marketCandidate.pick === 'PASS') {
    return passRecommendation([`${marketLabel(market)} edge did not clear the pass threshold`], market)
  }

  const starterEdge = row.homeStarter.pitchingRating - row.awayStarter.pitchingRating
  const bullpenEdge =
    row.homeBullpenWorkload.closerAvailable === row.awayBullpenWorkload.closerAvailable
      ? row.homeBullpenWorkload.last3DaysPitchCount < row.awayBullpenWorkload.last3DaysPitchCount
        ? 1
        : -1
      : row.homeBullpenWorkload.closerAvailable
        ? 2
        : -2
  const lineupEdge = lineupValue(row.homeLineupConfidence) - lineupValue(row.awayLineupConfidence)
  const sharpEdge = sharpAlignmentScore(row, market)

  const rawScore = marketCandidate.score * 3 + starterEdge * 0.4 + bullpenEdge * 1.4 + lineupEdge * 4 + sharpEdge * 2
  const tier = rawScore >= 28 ? 'A' : rawScore >= 20 ? 'B' : rawScore >= 14 ? 'C' : 'PASS'
  const score = clamp(rawScore / 10, 0, 10)

  const reasons = buildReasons({
    market,
    row,
    analysis,
    marketScore: marketCandidate.score,
    starterEdge,
    bullpenEdge,
    lineupEdge,
    sharpEdge,
  })

  return {
    primaryMarket: tier === 'PASS' ? 'PASS' : market,
    pick: tier === 'PASS' ? 'PASS' : marketCandidate.pick,
    score: Number(score.toFixed(1)),
    tier,
    pass: tier === 'PASS',
    reasons,
  }
}

function marketCandidateFor(market: CompositeMarket, analysis: BettingAnalysis) {
  if (market === 'ML') {
    return {
      market,
      pick: analysis.mlValueSide === 'none' ? 'PASS' : `${analysis.mlValueSide.toUpperCase()} ML`,
      score: Math.max(0, analysis.mlValuePct),
    }
  }

  if (market === 'RL') {
    return {
      market,
      pick: analysis.runLineRec === 'pass' ? 'PASS' : analysis.runLineRec.toUpperCase(),
      score: Math.max(0, analysis.runLineEdge),
    }
  }

  return {
    market,
    pick: analysis.ouRec === 'pass' ? 'PASS' : analysis.ouRec.toUpperCase(),
    score: Math.max(0, analysis.ouEdgePct),
  }
}

function passRecommendation(reasons: string[], market: CompositeRecommendation['primaryMarket'] = 'PASS'): CompositeRecommendation {
  return {
    primaryMarket: 'PASS',
    pick: 'PASS',
    score: 0,
    tier: 'PASS',
    pass: true,
    reasons: market === 'PASS' ? reasons : [`${marketLabel(market)}: ${reasons[0]}`],
  }
}

function marketLabel(market: CompositeRecommendation['primaryMarket']) {
  if (market === 'ML') return 'Moneyline'
  if (market === 'RL') return 'Run line'
  if (market === 'OU') return 'Total'
  return 'Composite'
}

function buildReasons(args: {
  market: CompositeMarket
  row: ScheduleRow
  analysis: BettingAnalysis
  marketScore: number
  starterEdge: number
  bullpenEdge: number
  lineupEdge: number
  sharpEdge: number
}) {
  const { market, row, analysis, marketScore, starterEdge, bullpenEdge, lineupEdge, sharpEdge } = args

  if (market === 'OU') {
    const totalGap = Math.abs(analysis.ouEdge)
    const projectedBias =
      analysis.ouRec === 'over'
        ? `Model projects ${row.result!.projectedTotal.toFixed(2)} vs market ${row.odds.overUnder.toFixed(1)}`
        : analysis.ouRec === 'under'
          ? `Model projects ${row.result!.projectedTotal.toFixed(2)} vs market ${row.odds.overUnder.toFixed(1)}`
          : `Model total is near market at ${row.odds.overUnder.toFixed(1)}`
    const runEnvironment =
      row.windDirection === 'Out'
        ? `Wind out ${row.windMph} mph boosts scoring`
        : row.windDirection === 'In'
          ? `Wind in ${row.windMph} mph suppresses scoring`
          : row.temperature >= 80
            ? `Warm ${row.temperature}F conditions support carry`
            : row.temperature <= 58
              ? `Cool ${row.temperature}F air suppresses carry`
          : `Neutral weather with market total ${row.odds.overUnder.toFixed(1)}`
    const pitchingEnvironment =
      starterEdge >= 6 || bullpenEdge >= 1
        ? 'Better home run prevention points to a lower-scoring script'
        : starterEdge <= -6 || bullpenEdge <= -1
          ? 'Better away run prevention points to a lower-scoring script'
          : 'Pitching context is balanced for the total'
    const lineupEnvironment =
      lineupEdge === 0
        ? 'Lineup certainty is balanced'
        : lineupEdge > 0
          ? 'Home lineup is firmer than away lineup'
          : 'Away lineup is firmer than home lineup'

    return [
      `Total edge ${marketScore.toFixed(1)}%`,
      totalGap >= 0.9 ? projectedBias : `Projected total differs by ${totalGap.toFixed(2)} runs`,
      runEnvironment,
      analysis.ouRec === 'over' ? overReason(row, lineupEnvironment) : underReason(pitchingEnvironment, sharpEdge),
    ]
  }

  return [
    `${marketLabel(market)} edge ${marketScore.toFixed(1)}%`,
    starterEdge >= 6 ? 'Starter edge favors home' : starterEdge <= -6 ? 'Starter edge favors away' : 'Starter matchup is close',
    bullpenEdge >= 1 ? 'Bullpen freshness favors home' : bullpenEdge <= -1 ? 'Bullpen freshness favors away' : 'Bullpen context is neutral',
    sharpEdge > 0 ? 'Sharp signals align' : sharpEdge < 0 ? 'Sharp signals disagree' : 'No strong sharp lean',
  ]
}

function overReason(row: ScheduleRow, lineupEnvironment: string) {
  const parkBoost = row.windDirection === 'Out' || row.temperature >= 80 || row.windMph >= 12
  return parkBoost ? 'Run environment supports an over script' : lineupEnvironment
}

function underReason(pitchingEnvironment: string, sharpEdge: number) {
  if (sharpEdge > 0) return 'Sharp total signals align with the under'
  return pitchingEnvironment
}

function lineupValue(value: ScheduleRow['homeLineupConfidence']) {
  switch (value) {
    case 'Confirmed':
      return 1
    case 'Projected':
      return 0
    case 'Thin':
      return -1
  }
}

function sharpAlignmentScore(row: ScheduleRow, market: CompositeMarket) {
  if (!row.sharpInput) return 0

  if (market === 'ML' || market === 'RL') {
    if (row.sharpInput.steamLean === 'home' || row.sharpInput.reverseLean === 'home') return 1
    if (row.sharpInput.steamLean === 'away' || row.sharpInput.reverseLean === 'away') return -1
  }

  if (market === 'OU') {
    if (row.sharpInput.steamLean === 'over' || row.sharpInput.reverseLean === 'over') return 1
    if (row.sharpInput.steamLean === 'under' || row.sharpInput.reverseLean === 'under') return -1
  }

  return 0
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}
