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
  overrideSource,
  setOverrideSource,
  overridePaste,
  setOverridePaste,
  useApprovedOverrides,
  setUseApprovedOverrides,
  oddsOverrides,
  refresh,
  runPredictions,
  runPipeline,
  importOverrides,
  captureOverrides,
  approveAllOverrides,
  rejectAllOverrides,
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
        <label className="field">
          <span>Override Source</span>
          <input type="text" value={overrideSource} onChange={(event) => setOverrideSource(event.target.value)} />
        </label>
        <label className="field checkbox-field">
          <span>Use Approved Overrides</span>
          <input type="checkbox" checked={useApprovedOverrides} onChange={(event) => setUseApprovedOverrides(event.target.checked)} />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={() => void runPredictions()} disabled={loading}>
          Run Automated Predictions
        </button>
        <button className="primary-button" onClick={() => void runPipeline()} disabled={loading}>
          Run Daily Pipeline
        </button>
        <button className="primary-button" onClick={() => void ingestResults()} disabled={loading}>
          Ingest Automated Results
        </button>
        <button className="secondary-button" onClick={() => void refresh()} disabled={loading}>
          Refresh Dashboard
        </button>
      </div>

      <div className="subsection">
        <h3>Odds Override Review</h3>
        <p className="subtle-copy">Paste the real lines you use, stage them in Postgres, review them, then approve them before running the pipeline with override mode enabled.</p>
        <textarea
          className="bulk-textarea"
          value={overridePaste}
          onChange={(event) => setOverridePaste(event.target.value)}
          placeholder="Paste sportsbook odds blocks here..."
        />
        <div className="action-row">
          <button className="primary-button" onClick={() => void importOverrides()} disabled={loading}>
            Import Overrides
          </button>
          <button className="secondary-button" onClick={() => void captureOverrides()} disabled={loading}>
            Capture Odds
          </button>
          <button className="secondary-button secondary-button-success" onClick={() => void approveAllOverrides()} disabled={loading}>
            Approve Source
          </button>
          <button className="secondary-button secondary-button-error" onClick={() => void rejectAllOverrides()} disabled={loading}>
            Reject Source
          </button>
        </div>

        {oddsOverrides.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['LookupKey', 'Matchup', 'Status', 'Source', 'Moneyline', 'Run Line', 'Total'].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oddsOverrides.map((override) => (
                  <tr key={`${override.lookupKey}-${override.source}`}>
                    <td>{override.lookupKey}</td>
                    <td>{`${override.awayTeam} at ${override.homeTeam}`}</td>
                    <td>{override.status}</td>
                    <td>{override.source}</td>
                    <td>{`${signed(override.odds.awayMoneyline)}/${signed(override.odds.homeMoneyline)}`}</td>
                    <td>{`${signed(override.odds.runLine)} (${signed(override.odds.runLineAwayOdds)}/${signed(override.odds.runLineHomeOdds)})`}</td>
                    <td>{`${override.odds.overUnder.toFixed(1)} (${signed(override.odds.overOdds)}/${signed(override.odds.underOdds)})`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle-copy">No odds overrides are stored for the selected run date yet.</p>
        )}
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

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value}`
}
