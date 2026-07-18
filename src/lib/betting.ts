import type { BettingAnalysis, OddsInput, PredictionResult } from './mlbTypes'
import { normCDF } from './mlbModel'

export function americanToImplied(odds: number): number {
  if (!odds || Number.isNaN(odds)) return 0.5
  return odds < 0 ? Math.abs(odds) / (Math.abs(odds) + 100) : 100 / (odds + 100)
}

export function mlAmerican(probability: number): string {
  if (probability <= 0 || probability >= 1) return 'N/A'
  return probability >= 0.5
    ? `-${Math.round((probability / (1 - probability)) * 100)}`
    : `+${Math.round(((1 - probability) / probability) * 100)}`
}

export function analyzeBetting(result: PredictionResult, odds: OddsInput): BettingAnalysis {
  const homeImplied = americanToImplied(odds.homeMoneyline)
  const awayImplied = americanToImplied(odds.awayMoneyline)
  const mlVig = homeImplied + awayImplied
  const homeFair = homeImplied / mlVig
  const awayFair = awayImplied / mlVig
  const homeEdge = result.homeWinProb - homeFair
  const awayEdge = result.awayWinProb - awayFair
  const mlValueSide = homeEdge > 0.025 ? 'home' : awayEdge > 0.025 ? 'away' : 'none'
  const mlValuePct = Math.max(homeEdge, awayEdge) * 100

  const projectedMargin = result.projectedMargin
  // Recalibrated from 2.45 to 5.5 via MLE fit against 1,423 graded 2026 run-line outcomes.
  // At 2.45 the model was badly overconfident that projected favorites would cover -1.5
  // (actual cover rate on those picks was ~40%, well below what 2.45 implied), which lost
  // -95 units betting every non-pass run-line recommendation over the sample.
  const runLineStd = 5.5
  const homeCoverProb = clamp(1 - normCDF((Math.abs(odds.runLine) - projectedMargin) / runLineStd), 0.08, 0.86)
  const awayCoverProb = 1 - homeCoverProb
  const homeRunLineImplied = americanToImplied(odds.runLineHomeOdds)
  const awayRunLineImplied = americanToImplied(odds.runLineAwayOdds)
  const runLineVig = homeRunLineImplied + awayRunLineImplied
  const homeRunLineEdge = homeCoverProb - homeRunLineImplied / runLineVig
  const awayRunLineEdge = awayCoverProb - awayRunLineImplied / runLineVig
  const awayRunLine = -odds.runLine
  const runLineRec =
    homeRunLineEdge > 0.03
      ? `home ${odds.runLine > 0 ? '+' : ''}${odds.runLine}`
      : awayRunLineEdge > 0.03
        ? `away ${awayRunLine > 0 ? '+' : ''}${awayRunLine}`
        : 'pass'
  const runLineEdge = Math.max(homeRunLineEdge, awayRunLineEdge) * 100

  const totalGap = result.projectedTotal - odds.overUnder
  // Recalibrated from 2.15 to 20 against 1,423 graded 2026 totals. Log-loss was swept from
  // 2.15 up through 5,000 and never beat the score of just guessing the league-average over
  // rate for every game — projectedTotal currently has no measurable edge over the market
  // total in this sample. 20 is set high enough that O/U edge% will rarely clear the pass
  // threshold until the total-projection logic itself is improved (see MLB_RESIDUAL_MODEL_PLAN.md),
  // rather than continuing to generate confident-looking picks with no real signal behind them
  // (totals lost -101.5 units betting every non-pass recommendation over the sample).
  const totalStdDev = 20
  const pOver = clamp(1 - normCDF((odds.overUnder - result.projectedTotal) / totalStdDev), 0.1, 0.9)
  const pUnder = 1 - pOver
  const overImplied = americanToImplied(odds.overOdds)
  const underImplied = americanToImplied(odds.underOdds)
  const totalVig = overImplied + underImplied
  const overEdge = pOver - overImplied / totalVig
  const underEdge = pUnder - underImplied / totalVig
  const ouRec = totalGap > 0.4 ? 'over' : totalGap < -0.4 ? 'under' : 'pass'
  const ouEdgePct =
    (ouRec === 'over' ? overEdge : ouRec === 'under' ? underEdge : Math.max(overEdge, underEdge)) * 100

  const kellyHome = homeEdge > 0 ? (homeEdge / (1 - homeFair)) * 0.25 : 0
  const kellyAway = awayEdge > 0 ? (awayEdge / (1 - awayFair)) * 0.25 : 0
  const selectedRunLineFair = runLineRec.startsWith('home') ? homeRunLineImplied / runLineVig : awayRunLineImplied / runLineVig
  const kellyRunLine = runLineRec !== 'pass' && runLineEdge > 0 ? (runLineEdge / 100 / (1 - selectedRunLineFair)) * 0.25 : 0
  const selectedTotalFair = ouRec === 'over' ? overImplied / totalVig : underImplied / totalVig
  const kellyOU = ouRec !== 'pass' && ouEdgePct > 0 ? (ouEdgePct / 100 / (1 - selectedTotalFair)) * 0.25 : 0

  return {
    homeImpliedProb: homeFair,
    awayImpliedProb: awayFair,
    homeEdge,
    awayEdge,
    mlValueSide,
    mlValuePct,
    runLineRec,
    runLineEdge,
    ouRec,
    ouEdge: totalGap,
    ouEdgePct,
    homeCoverProb,
    awayCoverProb,
    pOver,
    pUnder,
    kellyHome,
    kellyAway,
    kellyRunLine,
    kellyOU,
  }
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value))
}
