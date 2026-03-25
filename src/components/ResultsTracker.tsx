import type { TrackerSummary } from '../hooks/useResultsTracker'

type ResultsTrackerProps = {
  summary: TrackerSummary
}

export function ResultsTracker({ summary }: ResultsTrackerProps) {
  return (
    <section className="panel">
      <h2>Results Tracker</h2>
      <p>
        This area aggregates the latest evaluation report so we can track MLB performance across markets in one place.
      </p>
      <div className="meta-chip-row">
        <span className="meta-chip">ML: {summary.moneyline}</span>
        <span className="meta-chip">RL: {summary.runLine}</span>
        <span className="meta-chip">OU: {summary.total}</span>
        <span className="meta-chip">ROI: {summary.roi}</span>
        <span className="meta-chip">Bets: {summary.totalBets}</span>
      </div>
    </section>
  )
}
