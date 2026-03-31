import { useState } from 'react'

import {
  DEFAULT_THRESHOLDS,
  evaluatePredictions,
  parsePredictionsCsv,
  parseResultsCsv,
  type CalibrationThresholds,
  type EdgeBucketSummary,
  type EvaluationReport,
} from '../lib/modelEvaluation'

type SummaryCardProps = {
  label: string
  summary: EvaluationReport['moneyline']
}

function SummaryCard({
  label,
  summary,
}: SummaryCardProps) {
  return (
    <article className="mini-card">
      <span>{label}</span>
      <strong>
        {summary.wins}-{summary.losses}
      </strong>
      <small>
        {summary.totalBets} bets · {summary.winPct}% · ROI {summary.roiUnits >= 0 ? '+' : ''}
        {summary.roiUnits.toFixed(2)}u
      </small>
      <small>
        Push {summary.pushes} · Pending {summary.pending}
      </small>
    </article>
  )
}

function BucketCard({ label, bucket }: { label: string; bucket: EdgeBucketSummary }) {
  return (
    <article className="mini-card">
      <span>
        {label} {bucket.label}
      </span>
      <strong>
        {bucket.wins}-{bucket.losses}
      </strong>
      <small>
        {bucket.totalBets} bets · settled {bucket.settledBets} · {bucket.winPct}%
      </small>
      <small>
        ROI {bucket.roiUnits >= 0 ? '+' : ''}
        {bucket.roiUnits.toFixed(2)}u
      </small>
    </article>
  )
}

export function ModelEvaluation() {
  const [predictionsPaste, setPredictionsPaste] = useState('')
  const [resultsPaste, setResultsPaste] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [report, setReport] = useState<EvaluationReport | null>(null)
  const [thresholds, setThresholds] = useState<CalibrationThresholds>(DEFAULT_THRESHOLDS)

  const handleEvaluate = () => {
    setError('')
    setStatus('')

    try {
      const predictions = parsePredictionsCsv(predictionsPaste)
      const results = parseResultsCsv(resultsPaste)
      const nextReport = evaluatePredictions(predictions, results, thresholds)
      setReport(nextReport)
      setStatus(
        `Evaluated ${nextReport.rows.length} MLB bets using thresholds ML ${thresholds.moneylineEdgePct.toFixed(1)}%, RL ${thresholds.runLineEdgePct.toFixed(1)}%, OU ${thresholds.totalEdgePct.toFixed(1)}%.`,
      )
    } catch (evaluationError) {
      const message = evaluationError instanceof Error ? evaluationError.message : 'Unable to evaluate CSV data.'
      setError(message)
      setReport(null)
    }
  }

  return (
    <section className="panel">
      <h2>Model Evaluation</h2>
      <p>Paste the exported MLB predictions CSV and a simple results CSV to grade bets, then tune thresholds and inspect edge-bucket diagnostics.</p>

      <div className="controls-grid">
        <label className="field">
          <span>Moneyline Threshold</span>
          <input
            type="range"
            min="1"
            max="8"
            step="0.5"
            value={thresholds.moneylineEdgePct}
            onChange={(event) => setThresholds((prev) => ({ ...prev, moneylineEdgePct: Number(event.target.value) }))}
          />
          <strong>{thresholds.moneylineEdgePct.toFixed(1)}%</strong>
        </label>
        <label className="field">
          <span>Run Line Threshold</span>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={thresholds.runLineEdgePct}
            onChange={(event) => setThresholds((prev) => ({ ...prev, runLineEdgePct: Number(event.target.value) }))}
          />
          <strong>{thresholds.runLineEdgePct.toFixed(1)}%</strong>
        </label>
        <label className="field">
          <span>Total Threshold</span>
          <input
            type="range"
            min="1"
            max="10"
            step="0.5"
            value={thresholds.totalEdgePct}
            onChange={(event) => setThresholds((prev) => ({ ...prev, totalEdgePct: Number(event.target.value) }))}
          />
          <strong>{thresholds.totalEdgePct.toFixed(1)}%</strong>
        </label>
      </div>

      <div className="controls-grid two-textareas">
        <label className="field">
          <span>Predictions CSV</span>
          <textarea
            className="bulk-textarea"
            value={predictionsPaste}
            onChange={(event) => setPredictionsPaste(event.target.value)}
            placeholder="Paste exported MLB predictions CSV here..."
          />
        </label>
        <label className="field">
          <span>Results CSV</span>
          <textarea
            className="bulk-textarea"
            value={resultsPaste}
            onChange={(event) => setResultsPaste(event.target.value)}
            placeholder="Paste results CSV with Date,Away,Home,AwayScore,HomeScore,LookupKey..."
          />
        </label>
      </div>

      <div className="action-row">
        <button className="primary-button" onClick={handleEvaluate} disabled={!predictionsPaste.trim() || !resultsPaste.trim()}>
          Evaluate Model
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            setPredictionsPaste('')
            setResultsPaste('')
            setStatus('')
            setError('')
            setReport(null)
            setThresholds(DEFAULT_THRESHOLDS)
          }}
        >
          Clear
        </button>
      </div>

      {status ? <p className="success-copy">{status}</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}

      {report ? (
        <>
          <div className="metric-grid">
            <SummaryCard label="Moneyline" summary={report.moneyline} />
            <SummaryCard label="Run Line" summary={report.runLine} />
            <SummaryCard label="Totals" summary={report.totals} />
          </div>

          <div className="subsection">
            <h3>Edge Bucket Diagnostics</h3>
            <div className="metric-grid">
              {report.edgeBuckets.ML.map((bucket) => (
                <BucketCard key={`ML-${bucket.label}`} label="ML" bucket={bucket} />
              ))}
              {report.edgeBuckets.RL.map((bucket) => (
                <BucketCard key={`RL-${bucket.label}`} label="RL" bucket={bucket} />
              ))}
              {report.edgeBuckets.OU.map((bucket) => (
                <BucketCard key={`OU-${bucket.label}`} label="OU" bucket={bucket} />
              ))}
            </div>
          </div>

          <div className="subsection">
            <h3>Bet Log</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Date', 'Matchup', 'Type', 'Rec', 'Edge', 'Odds', 'Result', 'Units', 'Key'].map((header) => (
                      <th key={header}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={`${row.lookupKey}-${row.betType}`}>
                      <td>{row.date}</td>
                      <td>{row.matchup}</td>
                      <td>{row.betType}</td>
                      <td>{row.recommendation}</td>
                      <td>{row.edgePct == null ? '-' : `${row.edgePct.toFixed(1)}%`}</td>
                      <td>{row.odds == null ? '-' : `${row.odds > 0 ? '+' : ''}${row.odds}`}</td>
                      <td>{row.result}</td>
                      <td>
                        {row.units > 0 ? '+' : ''}
                        {row.units.toFixed(2)}u
                      </td>
                      <td>{row.lookupKey}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </section>
  )
}
