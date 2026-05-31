import { useRef, useState } from 'react'

import {
  DEFAULT_THRESHOLDS,
  evaluatePredictions,
  parseMasterSheetCsv,
  parsePredictionsCsv,
  parseResultsCsv,
  type CalibrationData,
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

type CsvFileInputProps = {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}

function CsvFileInput({ label, value, placeholder, onChange }: CsvFileInputProps) {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result
      if (typeof text === 'string') {
        onChange(text)
        setFileName(file.name)
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) loadFile(file)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  const handleClear = () => {
    onChange('')
    setFileName(null)
  }

  return (
    <label className="field">
      <span>{label}</span>
      <div
        className={`csv-drop-zone${dragging ? ' csv-drop-zone--over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="csv-drop-zone-input"
          onChange={handleFileInput}
        />
        {fileName ? (
          <span className="csv-drop-zone-file">
            <span className="csv-drop-zone-filename">{fileName}</span>
            <button
              type="button"
              className="csv-drop-zone-clear"
              onClick={(e) => { e.stopPropagation(); handleClear() }}
            >
              ✕
            </button>
          </span>
        ) : (
          <span className="csv-drop-zone-prompt">Drop .csv file or click to browse</span>
        )}
      </div>
      <textarea
        className="bulk-textarea"
        value={value}
        onChange={(e) => { onChange(e.target.value); setFileName(null) }}
        placeholder={placeholder}
      />
    </label>
  )
}

function deltaClass(delta: number) {
  if (delta > 0.15) return 'danger-copy'
  if (delta < -0.15) return 'success-copy'
  return 'subtle-copy'
}

function CalibrationSection({ calibration }: { calibration: CalibrationData }) {
  const { projectionBias, teamBias, edgeCalibration } = calibration
  const hasCalibration = projectionBias !== null || teamBias.length > 0

  if (!hasCalibration) return null

  return (
    <>
      {projectionBias ? (
        <div className="subsection">
          <h3>Projection Bias</h3>
          <p className="subtle-copy">
            Positive delta means the model underestimates — actual runs exceeded projections.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['', 'Avg Projected', 'Avg Actual', 'Delta (actual − proj)'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Home runs</td>
                  <td>{projectionBias.avgProjectedHome.toFixed(2)}</td>
                  <td>{projectionBias.avgActualHome.toFixed(2)}</td>
                  <td className={deltaClass(projectionBias.homeDelta)}>
                    {projectionBias.homeDelta > 0 ? '+' : ''}{projectionBias.homeDelta.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td>Away runs</td>
                  <td>{projectionBias.avgProjectedAway.toFixed(2)}</td>
                  <td>{projectionBias.avgActualAway.toFixed(2)}</td>
                  <td className={deltaClass(projectionBias.awayDelta)}>
                    {projectionBias.awayDelta > 0 ? '+' : ''}{projectionBias.awayDelta.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td><strong>Total</strong></td>
                  <td><strong>{projectionBias.avgProjectedTotal.toFixed(2)}</strong></td>
                  <td><strong>{projectionBias.avgActualTotal.toFixed(2)}</strong></td>
                  <td className={deltaClass(projectionBias.totalDelta)}>
                    <strong>{projectionBias.totalDelta > 0 ? '+' : ''}{projectionBias.totalDelta.toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="subtle-copy">{projectionBias.games} games with results</p>
        </div>
      ) : null}

      {teamBias.length > 0 ? (
        <div className="subsection">
          <h3>Team Bias (Home Runs — min 3 games)</h3>
          <p className="subtle-copy">
            Sorted by largest absolute delta. Positive = model underestimates home runs at this park.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Team', 'Games', 'Avg Projected', 'Avg Actual', 'Delta'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teamBias.slice(0, 15).map((row) => (
                  <tr key={row.team}>
                    <td>{row.team}</td>
                    <td>{row.games}</td>
                    <td>{row.avgProjectedHome.toFixed(2)}</td>
                    <td>{row.avgActualHome.toFixed(2)}</td>
                    <td className={deltaClass(row.delta)}>
                      {row.delta > 0 ? '+' : ''}{row.delta.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {(edgeCalibration.ML.length > 0 || edgeCalibration.RL.length > 0 || edgeCalibration.OU.length > 0) ? (
        <div className="subsection">
          <h3>Edge Calibration</h3>
          <p className="subtle-copy">
            Does higher edge% actually win more? Bets at all thresholds, grouped by edge size.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {['Market', 'Edge bucket', 'Bets', 'Settled', 'W–L', 'Win rate'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['ML', 'RL', 'OU'] as const).flatMap((market) =>
                  edgeCalibration[market].map((b) => {
                    const winRateNum = b.settledBets > 0 ? (b.wins / b.settledBets) * 100 : null
                    const cls = winRateNum == null ? '' : winRateNum >= 55 ? 'success-copy' : winRateNum <= 45 ? 'danger-copy' : ''
                    return (
                      <tr key={`${market}-${b.label}`}>
                        <td>{market}</td>
                        <td>{b.label}</td>
                        <td>{b.bets}</td>
                        <td>{b.settledBets}</td>
                        <td>{b.settledBets > 0 ? `${b.wins}–${b.losses}` : '—'}</td>
                        <td className={cls}>{b.winRate === '-' ? '—' : `${b.winRate}%`}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  )
}

type EvalMode = 'master' | 'separate'

export function ModelEvaluation() {
  const [mode, setMode] = useState<EvalMode>('master')
  const [masterSheet, setMasterSheet] = useState('')
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
      let predictions, results
      if (mode === 'master') {
        ;({ predictions, results } = parseMasterSheetCsv(masterSheet))
      } else {
        predictions = parsePredictionsCsv(predictionsPaste)
        results = parseResultsCsv(resultsPaste)
      }
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

  const handleClear = () => {
    setMasterSheet('')
    setPredictionsPaste('')
    setResultsPaste('')
    setStatus('')
    setError('')
    setReport(null)
    setThresholds(DEFAULT_THRESHOLDS)
  }

  const canEvaluate = mode === 'master' ? masterSheet.trim().length > 0 : predictionsPaste.trim().length > 0 && resultsPaste.trim().length > 0

  return (
    <section className="panel">
      <h2>Model Evaluation</h2>
      <p>Grade bets, tune thresholds, and inspect edge-bucket diagnostics.</p>

      <div className="eval-mode-toggle">
        <button
          className={`eval-mode-btn${mode === 'master' ? ' active' : ''}`}
          onClick={() => setMode('master')}
          type="button"
        >
          Master Sheet
        </button>
        <button
          className={`eval-mode-btn${mode === 'separate' ? ' active' : ''}`}
          onClick={() => setMode('separate')}
          type="button"
        >
          Separate Files
        </button>
      </div>

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

      {mode === 'master' ? (
        <CsvFileInput
          label="Master Sheet (predictions + results combined)"
          value={masterSheet}
          placeholder="Paste or drop the combined predictions/results CSV here..."
          onChange={setMasterSheet}
        />
      ) : (
        <div className="controls-grid two-textareas">
          <CsvFileInput
            label="Predictions CSV"
            value={predictionsPaste}
            placeholder="Paste exported MLB predictions CSV here..."
            onChange={setPredictionsPaste}
          />
          <CsvFileInput
            label="Results CSV"
            value={resultsPaste}
            placeholder="Paste results CSV with Date,Away,Home,AwayScore,HomeScore,LookupKey..."
            onChange={setResultsPaste}
          />
        </div>
      )}

      <div className="action-row">
        <button className="primary-button" onClick={handleEvaluate} disabled={!canEvaluate}>
          Evaluate Model
        </button>
        <button className="secondary-button" onClick={handleClear}>
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

          <CalibrationSection calibration={report.calibration} />

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
