import { analyzeBetting, mlAmerican } from '../lib/betting'
import type { OddsInput, PredictionResult, TeamStats } from '../lib/mlbTypes'

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
      </div>
    </section>
  )
}
