import type { useAutomationDashboard } from '../hooks/useAutomationDashboard'

type AutomationDashboardProps = ReturnType<typeof useAutomationDashboard>

function SummaryCard({
  label,
  wins,
  losses,
  pushes,
  pending,
  roiUnits,
  winPct,
}: {
  label: string
  wins: number
  losses: number
  pushes: number
  pending: number
  roiUnits: number
  winPct: string
}) {
  return (
    <article className="mini-card">
      <span>{label}</span>
      <strong>{`${wins}-${losses}-${pushes}`}</strong>
      <small>{winPct}% settled hit rate</small>
      <small>
        Pending {pending} · ROI {roiUnits >= 0 ? '+' : ''}
        {roiUnits.toFixed(2)}u
      </small>
    </article>
  )
}

export function AutomationDashboard({
  runDate,
  setRunDate,
  resultsDate,
  setResultsDate,
  apiAvailable,
  loading,
  status,
  error,
  latestRuns,
  evaluation,
  refresh,
  runPredictions,
  ingestResults,
}: AutomationDashboardProps) {
  return (
    <section className="panel">
      <h2>Automation Dashboard</h2>
      <p>Use the API-backed automation layer for scheduled runs and persisted reporting while keeping manual fallback mode available in the Predictor tab.</p>

      <p className={`subtle-copy ${apiAvailable ? 'success-copy' : apiAvailable === false ? 'error-copy' : ''}`}>{status}</p>
      {error ? <p className="error-copy">{error}</p> : null}

      <div className="controls-grid">
        <label className="field">
          <span>Prediction Run Date</span>
          <input type="date" value={runDate} onChange={(event) => setRunDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Results Ingest Date</span>
          <input type="date" value={resultsDate} onChange={(event) => setResultsDate(event.target.value)} />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={() => void runPredictions()} disabled={loading}>
          Run Automated Predictions
        </button>
        <button className="primary-button" onClick={() => void ingestResults()} disabled={loading}>
          Ingest Automated Results
        </button>
        <button className="secondary-button" onClick={() => void refresh()} disabled={loading}>
          Refresh Dashboard
        </button>
      </div>

      {evaluation ? (
        <div className="metric-grid">
          <SummaryCard label="Moneyline" {...evaluation.moneyline} />
          <SummaryCard label="Run Line" {...evaluation.runLine} />
          <SummaryCard label="Totals" {...evaluation.totals} />
        </div>
      ) : null}

      <div className="subsection">
        <h3>Recent Automation Runs</h3>
        {latestRuns.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Date', 'Model', 'Status', 'Review', 'Created', 'Exports'].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{run.businessDate.slice(0, 10)}</td>
                    <td>{run.modelVersion}</td>
                    <td>{run.status}</td>
                    <td>{run.reviewStatus}</td>
                    <td>{new Date(run.createdAt).toLocaleString()}</td>
                    <td>{run.exportPath ? 'Predictions CSV' : 'Pending exports'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle-copy">No persisted automation runs were found yet.</p>
        )}
      </div>
    </section>
  )
}
