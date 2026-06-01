import { analyzeBetting, mlAmerican } from '../lib/betting'
import type { OddsInput, PredictionResult, RunCalcSteps, TeamStats } from '../lib/mlbTypes'

type SingleGameResultsProps = {
  result: PredictionResult
  odds: OddsInput
  homeTeam: TeamStats
  awayTeam: TeamStats
  homeStarterName: string
  awayStarterName: string
}

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function fmt(value: number, decimals = 3) {
  return value.toFixed(decimals)
}

function RunCalcTable({ calc, teamAbbr, finalProjected, isHome }: { calc: RunCalcSteps; teamAbbr: string; finalProjected: number; isHome: boolean }) {
  const homeFieldBonus = isHome ? finalProjected - calc.projected : 0

  const rows: { label: string; value: string; note?: string }[] = [
    { label: 'League avg', value: fmt(calc.leagueAvg, 2) },
    { label: '× Split index', value: `×${fmt(calc.splitIndex)}`, note: `offense vs pitcher hand` },
    { label: '× Style adj', value: `×${fmt(calc.styleAdj)}`, note: 'power / discipline / contact' },
    {
      label: '× Prevention blend',
      value: `×${fmt(calc.blendedPrevention)}`,
      note: `starter ${pct(calc.starterShare)} · bullpen ${pct(1 - calc.starterShare)}`,
    },
    { label: '× Defense adj', value: `×${fmt(calc.defenseAdj)}` },
    { label: '× Park factor', value: `×${fmt(calc.parkFactor)}` },
    { label: '× Weather', value: `×${fmt(calc.weather)}` },
    { label: '× Lineup adj', value: `×${fmt(calc.lineupAdj)}` },
    ...(calc.playoffAdj !== 1 ? [{ label: '× Playoff adj', value: `×${fmt(calc.playoffAdj)}` }] : []),
    ...(isHome ? [{ label: '+ Home field', value: `+${fmt(homeFieldBonus, 2)}` }] : []),
  ]

  return (
    <div className="run-calc-table">
      <div className="run-calc-header">{teamAbbr} Run Projection</div>
      {rows.map((row) => (
        <div key={row.label} className="run-calc-row">
          <span className="run-calc-label">{row.label}</span>
          <span className="run-calc-value">{row.value}</span>
          {row.note && <span className="run-calc-note">{row.note}</span>}
        </div>
      ))}
      <div className="run-calc-row run-calc-total">
        <span className="run-calc-label">= Projected runs</span>
        <span className="run-calc-value">{fmt(finalProjected, 2)}</span>
      </div>
    </div>
  )
}

export function SingleGameResults({ result, odds, homeTeam, awayTeam, homeStarterName, awayStarterName }: SingleGameResultsProps) {
  const betting = analyzeBetting(result, odds)

  return (
    <section className="panel">
      <h2>Single Game Results</h2>
      <p>
        The Phase 1 model blends split-adjusted offense, starter quality, bullpen context, defense, park, and weather into a
        transparent MLB projection.
      </p>

      <div className="scoreboard">
        <div className="team-score">
          <span>{awayTeam.abbr}</span>
          <strong>{result.projectedAwayRuns.toFixed(2)}</strong>
          <small>{awayStarterName}</small>
        </div>
        <div className="score-divider">
          <span>Total</span>
          <strong>{result.projectedTotal.toFixed(2)}</strong>
          <small>{result.modelLean}</small>
        </div>
        <div className="team-score">
          <span>{homeTeam.abbr}</span>
          <strong>{result.projectedHomeRuns.toFixed(2)}</strong>
          <small>{homeStarterName}</small>
        </div>
      </div>

      <div className="metric-grid">
        <article className="mini-card">
          <span>Moneyline</span>
          <strong>{homeTeam.abbr} {mlAmerican(result.homeWinProb)}</strong>
          <small>{pct(result.homeWinProb)} home win / {pct(result.awayWinProb)} away win</small>
        </article>
        <article className="mini-card">
          <span>Run Line</span>
          <strong>{betting.runLineRec === 'pass' ? 'PASS' : betting.runLineRec.toUpperCase()}</strong>
          <small>{betting.runLineEdge.toFixed(1)}% edge</small>
        </article>
        <article className="mini-card">
          <span>Total</span>
          <strong>{betting.ouRec === 'pass' ? 'PASS' : betting.ouRec.toUpperCase()}</strong>
          <small>{result.projectedTotal.toFixed(2)} vs market {odds.overUnder.toFixed(1)}</small>
        </article>
      </div>

      <div className="metric-grid">
        <article className="mini-card">
          <span>Starter Workload</span>
          <strong>{awayStarterName}: {result.homeStarterInnings.toFixed(1)} IP</strong>
          <small>{homeStarterName}: {result.awayStarterInnings.toFixed(1)} IP</small>
        </article>
        <article className="mini-card">
          <span>Cover Probabilities</span>
          <strong>Home -1.5: {pct(result.homeRunLineCoverProb)}</strong>
          <small>Away +1.5: {pct(result.awayRunLineCoverProb)}</small>
        </article>
        <article className="mini-card">
          <span>Total Distribution</span>
          <strong>Over: {pct(result.overProb)}</strong>
          <small>Under: {pct(result.underProb)}</small>
        </article>
      </div>

      <div className="subsection">
        <h3>Probable Starter Context</h3>
        <div className="metric-grid">
          <article className="mini-card">
            <span>Away Starter Usage</span>
            <strong>{awayStarterName}</strong>
            <small>Projected to face the home lineup for about {result.awayStarterInnings.toFixed(1)} innings</small>
          </article>
          <article className="mini-card">
            <span>Home Starter Usage</span>
            <strong>{homeStarterName}</strong>
            <small>Projected to face the away lineup for about {result.homeStarterInnings.toFixed(1)} innings</small>
          </article>
          <article className="mini-card">
            <span>Lean Summary</span>
            <strong>{result.modelLean}</strong>
            <small>Starter quality and bullpen workload now feed directly into the run environment</small>
          </article>
        </div>
      </div>

      <div className="subsection">
        <h3>Market Comparison</h3>
        <div className="metric-grid">
          <article className="mini-card">
            <span>Moneyline Edge</span>
            <strong>{betting.mlValueSide === 'none' ? 'PASS' : `${betting.mlValueSide.toUpperCase()} ML`}</strong>
            <small>{betting.mlValuePct.toFixed(1)}% model edge</small>
          </article>
          <article className="mini-card">
            <span>Kelly Lean</span>
            <strong>{(Math.max(betting.kellyHome, betting.kellyAway) * 100).toFixed(1)}%</strong>
            <small>Quarter-Kelly guideline</small>
          </article>
          <article className="mini-card">
            <span>Total Edge</span>
            <strong>{betting.ouEdge > 0 ? '+' : ''}{betting.ouEdge.toFixed(2)} runs</strong>
            <small>{betting.ouEdgePct.toFixed(1)}% probability edge</small>
          </article>
        </div>
      </div>

      <div className="subsection">
        <h3>Model Drivers</h3>
        <div className="feature-list">
          {result.features.map((feature) => (
            <div key={feature.label} className="feature-row">
              <span>{feature.label}</span>
              <strong className={feature.good ? 'feature-good' : 'feature-bad'}>{feature.detail}</strong>
            </div>
          ))}
        </div>
        <div className="run-calc-grid">
          <RunCalcTable calc={result.awayCalc} teamAbbr={awayTeam.abbr} finalProjected={result.projectedAwayRuns} isHome={false} />
          <RunCalcTable calc={result.homeCalc} teamAbbr={homeTeam.abbr} finalProjected={result.projectedHomeRuns} isHome={true} />
        </div>
      </div>
    </section>
  )
}
