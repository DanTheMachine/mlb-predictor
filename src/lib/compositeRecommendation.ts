import type { BettingAnalysis, CompositeRecommendation, ScheduleRow } from './mlbTypes'

export function buildCompositeRecommendation(row: ScheduleRow, analysis: BettingAnalysis | null): CompositeRecommendation {
  if (!analysis || !row.result) {
    return { primaryMarket: 'PASS', pick: 'PASS', score: 0, tier: 'PASS', pass: true, reasons: ['Awaiting simulation'] }
  }

  const marketCandidates = [
    { market: 'ML' as const, pick: analysis.mlValueSide === 'none' ? 'PASS' : `${analysis.mlValueSide.toUpperCase()} ML`, score: Math.max(0, analysis.mlValuePct) },
    { market: 'RL' as const, pick: analysis.runLineRec === 'pass' ? 'PASS' : analysis.runLineRec.toUpperCase(), score: Math.max(0, analysis.runLineEdge) },
    { market: 'OU' as const, pick: analysis.ouRec === 'pass' ? 'PASS' : analysis.ouRec.toUpperCase(), score: Math.max(0, analysis.ouEdgePct) },
  ].sort((a, b) => b.score - a.score)

  const bestMarket = marketCandidates[0]
  if (!bestMarket || bestMarket.score < 2.5) {
    return { primaryMarket: 'PASS', pick: 'PASS', score: 0, tier: 'PASS', pass: true, reasons: ['No edge cleared the pass threshold'] }
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
  const lineupEdge =
    lineupValue(row.homeLineupConfidence) - lineupValue(row.awayLineupConfidence)
  const sharpEdge = sharpAlignmentScore(row, bestMarket.market)

  const score = bestMarket.score * 3 + starterEdge * 0.4 + bullpenEdge * 1.4 + lineupEdge * 4 + sharpEdge * 2
  const tier = score >= 28 ? 'A' : score >= 20 ? 'B' : score >= 14 ? 'C' : 'PASS'

  const reasons = [
    bestMarket.score >= 5 ? `Model edge ${bestMarket.score.toFixed(1)}%` : 'Modest model edge',
    starterEdge >= 6 ? 'Starter edge favors home' : starterEdge <= -6 ? 'Starter edge favors away' : 'Starter matchup is close',
    bullpenEdge >= 1 ? 'Bullpen freshness favors home' : bullpenEdge <= -1 ? 'Bullpen freshness favors away' : 'Bullpen context is neutral',
    sharpEdge > 0 ? 'Sharp signals align' : sharpEdge < 0 ? 'Sharp signals disagree' : 'No strong sharp lean',
  ]

  return {
    primaryMarket: tier === 'PASS' ? 'PASS' : bestMarket.market,
    pick: tier === 'PASS' ? 'PASS' : bestMarket.pick,
    score: Number(score.toFixed(1)),
    tier,
    pass: tier === 'PASS',
    reasons,
  }
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

function sharpAlignmentScore(row: ScheduleRow, market: 'ML' | 'RL' | 'OU') {
  if (!row.sharpInput) return 0
  if (market === 'ML') {
    if (row.sharpInput.steamLean === 'home' || row.sharpInput.reverseLean === 'home') return 1
    if (row.sharpInput.steamLean === 'away' || row.sharpInput.reverseLean === 'away') return -1
  }
  if (market === 'OU') {
    if (row.sharpInput.steamLean === 'over' || row.sharpInput.reverseLean === 'over') return 1
    if (row.sharpInput.steamLean === 'under' || row.sharpInput.reverseLean === 'under') return -1
  }
  return 0
}
