import type { useResultsTracker } from '../hooks/useResultsTracker'

type ResultsTrackerProps = ReturnType<typeof useResultsTracker>

function marketRecordLabel({
  w,
  l,
  p,
  pending,
}: {
  w: number
  l: number
  p: number
  pending: number
}) {
  const record = p > 0 ? `${w}-${l}-${p}` : `${w}-${l}`
  return pending > 0 ? `${record} · ${pending} pending` : record
}

function outcomeText(win: boolean | null | undefined, push: boolean | null | undefined) {
  if (push) return 'PUSH'
  if (win === true) return 'WIN'
  if (win === false) return 'LOSS'
  return '-'
}

function outcomeClass(win: boolean | null | undefined, push: boolean | null | undefined) {
  if (push) return ''
  if (win === true) return 'success-copy'
  if (win === false) return 'error-copy'
  return ''
}

function unitsLabel(units: number | null | undefined) {
  if (units == null) return '-'
  return `${units > 0 ? '+' : ''}${units.toFixed(2)}u`
}

export function ResultsTracker({
  resultsStatus,
  resultsError,
  gradedRows,
  stats,
  handleFetchResults,
  fetchingResults,
  resultsLog,
  predLog,
  setResultsLog,
  setPredLog,
  setResultsStatus,
  resultsPaste,
  setResultsPaste,
  handleImportResults,
  predPaste,
  setPredPaste,
  handleImportPredictions,
}: ResultsTrackerProps) {
  return (
    <section className="panel">
      <h2>Results Tracker</h2>
      <p>Import exported MLB predictions and results here to keep a separate running grade board without using Model Eval.</p>

      {resultsStatus ? <p className="success-copy">{resultsStatus}</p> : null}
      {resultsError ? <p className="error-copy">{resultsError}</p> : null}

      {gradedRows.some((row) => row.graded) ? (
        <div className="metric-grid">
          <article className="mini-card">
            <span>Moneyline</span>
            <strong>{marketRecordLabel(stats.ml)}</strong>
            <small>{stats.ml.pct}% win rate</small>
            <small>
              ROI {Number.parseFloat(stats.ml.roi) >= 0 ? '+' : ''}
              {stats.ml.roi}u
            </small>
          </article>
          <article className="mini-card">
            <span>Run Line</span>
            <strong>{marketRecordLabel(stats.rl)}</strong>
            <small>{stats.rl.pct}% win rate</small>
            <small>
              ROI {Number.parseFloat(stats.rl.roi) >= 0 ? '+' : ''}
              {stats.rl.roi}u
            </small>
          </article>
          <article className="mini-card">
            <span>Totals</span>
            <strong>{marketRecordLabel(stats.ou)}</strong>
            <small>{stats.ou.pct}% win rate</small>
            <small>
              ROI {Number.parseFloat(stats.ou.roi) >= 0 ? '+' : ''}
              {stats.ou.roi}u
            </small>
          </article>
        </div>
      ) : null}

      <div className="action-row">
        <button className="primary-button" onClick={() => void handleFetchResults()} disabled={fetchingResults}>
          {fetchingResults ? 'Fetching...' : "Download Yesterday's Results"}
        </button>
        {resultsLog.length > 0 || predLog.length > 0 ? (
          <button
            className="secondary-button secondary-button-error"
            onClick={() => {
              setResultsLog([])
              setPredLog([])
              setResultsStatus('Cleared all tracked data.')
            }}
          >
            Clear All
          </button>
        ) : null}
      </div>

      <div className="controls-grid two-textareas">
        <div className="subsection">
          <label className="field">
            <span>Predictions CSV</span>
            <textarea
              className="bulk-textarea"
              value={predPaste}
              onChange={(event) => setPredPaste(event.target.value)}
              placeholder="Paste the exported mlb-predictions-YYYY-MM-DD.csv content here..."
            />
          </label>
          <div className="action-row">
            <button className="primary-button" onClick={handleImportPredictions} disabled={!predPaste.trim()}>
              Import Predictions
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setPredPaste('')
              }}
              disabled={!predPaste.trim()}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="subsection">
          <label className="field">
            <span>Results CSV</span>
            <textarea
              className="bulk-textarea"
              value={resultsPaste}
              onChange={(event) => setResultsPaste(event.target.value)}
              placeholder="Date,Home,Away,Home Score,Away Score&#10;2026-03-29,LAD,ATL,6,3"
            />
          </label>
          <div className="action-row">
            <button className="primary-button" onClick={handleImportResults} disabled={!resultsPaste.trim()}>
              Import Results
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                setResultsPaste('')
              }}
              disabled={!resultsPaste.trim()}
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {predLog.length > 0 ? (
        <div className="subsection">
          <h3>
            Game Log
          </h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Date', 'Matchup', 'Proj', 'Actual', 'Total', 'ML Rec', 'ML', 'RL Rec', 'RL', 'OU Rec', 'OU'].map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gradedRows.map((row) => (
                  <tr key={row.lookupKey}>
                    <td>{row.date}</td>
                    <td>{`${row.away} at ${row.home}`}</td>
                    <td>{row.awayRuns != null && row.homeRuns != null ? `${row.awayRuns.toFixed(2)}-${row.homeRuns.toFixed(2)}` : '-'}</td>
                    <td>{row.resultRow ? `${row.resultRow.awayScore}-${row.resultRow.homeScore}` : 'pending'}</td>
                    <td>{row.actualTotal != null ? `${row.actualTotal} (m${row.projectedTotal?.toFixed(2) ?? '-'})` : '-'}</td>
                    <td>{row.moneylineRec || 'PASS'}</td>
                    <td className={outcomeClass(row.moneylineWin, false)}>
                      {outcomeText(row.moneylineWin, false)}
                      {row.moneylineUnits != null ? ` ${unitsLabel(row.moneylineUnits)}` : ''}
                    </td>
                    <td>{row.runLineRec || 'PASS'}</td>
                    <td className={outcomeClass(row.runLineWin, row.runLinePush)}>
                      {outcomeText(row.runLineWin, row.runLinePush)}
                      {row.runLineUnits != null ? ` ${unitsLabel(row.runLineUnits)}` : ''}
                    </td>
                    <td>{row.totalRec || 'PASS'}</td>
                    <td className={outcomeClass(row.totalWin, row.totalPush)}>
                      {outcomeText(row.totalWin, row.totalPush)}
                      {row.totalUnits != null ? ` ${unitsLabel(row.totalUnits)}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {predLog.length === 0 && resultsLog.length === 0 ? (
        <div className="subsection">
          <p className="subtle-copy">
            1. Export predictions from the Predictor tab.
            <br />
            2. Paste predictions CSV here.
            <br />
            3. Download or paste completed results.
            <br />
            4. The tracker grades the markets automatically.
          </p>
        </div>
      ) : null}
    </section>
  )
}
