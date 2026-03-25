import { useState } from 'react'

import type { EvaluationReport } from '../lib/modelEvaluation'

export type TrackerSummary = {
  moneyline: string
  runLine: string
  total: string
  roi: string
  totalBets: number
}

export function useResultsTracker() {
  const [report, setReport] = useState<EvaluationReport | null>(null)

  const summary: TrackerSummary = report
    ? {
        moneyline: `${report.moneyline.wins}-${report.moneyline.losses}`,
        runLine: `${report.runLine.wins}-${report.runLine.losses}`,
        total: `${report.totals.wins}-${report.totals.losses}`,
        roi: `${totalRoi(report) >= 0 ? '+' : ''}${totalRoi(report).toFixed(2)}u`,
        totalBets: report.rows.length,
      }
    : {
        moneyline: '0-0',
        runLine: '0-0',
        total: '0-0',
        roi: '+0.00u',
        totalBets: 0,
      }

  return { report, setReport, summary }
}

function totalRoi(report: EvaluationReport) {
  return report.moneyline.roiUnits + report.runLine.roiUnits + report.totals.roiUnits
}
