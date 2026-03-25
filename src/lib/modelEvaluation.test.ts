import { describe, expect, it } from 'vitest'

import { DEFAULT_THRESHOLDS, evaluatePredictions, parsePredictionsCsv, parseResultsCsv } from './modelEvaluation'

describe('modelEvaluation', () => {
  it('parses exported prediction csv rows and grades recommendations', () => {
    const predictionsCsv = `"Date","GameTime","Away","Home","LookupKey","AwayStarter","HomeStarter","AwayRuns","HomeRuns","Total","Margin","HomeWinProb","AwayWinProb","MoneylineRec","MoneylineEdgePct","RunLineRec","RunLineEdgePct","TotalRec","TotalEdgePct","MarketTotal","HomeML","AwayML","RunLine","RunLineHomeOdds","RunLineAwayOdds","OverOdds","UnderOdds"
"2026-03-25","7:10 PM","ATL","LAD","20260325LADATL","Chris Sale","Tyler Glasnow","3.90","4.80","8.70","0.90","59.2","40.8","HOME ML","4.1","PASS","","OVER","5.2","8.0","-145","+125","-1.5","+135","-160","-110","-110"`

    const resultsCsv = `"Date","Away","Home","AwayScore","HomeScore","LookupKey"
"2026-03-25","ATL","LAD","3","6","20260325LADATL"`

    const predictions = parsePredictionsCsv(predictionsCsv)
    const results = parseResultsCsv(resultsCsv)
    const report = evaluatePredictions(predictions, results, DEFAULT_THRESHOLDS)

    expect(report.moneyline.wins).toBe(1)
    expect(report.totals.wins).toBe(1)
    expect(report.rows).toHaveLength(2)
  })

  it('marks bets pending when results are missing', () => {
    const predictionsCsv = `"Date","GameTime","Away","Home","LookupKey","AwayStarter","HomeStarter","AwayRuns","HomeRuns","Total","Margin","HomeWinProb","AwayWinProb","MoneylineRec","MoneylineEdgePct","RunLineRec","RunLineEdgePct","TotalRec","TotalEdgePct","MarketTotal","HomeML","AwayML","RunLine","RunLineHomeOdds","RunLineAwayOdds","OverOdds","UnderOdds"
"2026-03-25","7:10 PM","ATL","LAD","20260325LADATL","Chris Sale","Tyler Glasnow","3.90","4.80","8.70","0.90","59.2","40.8","HOME ML","4.1","HOME -1.5","3.9","OVER","5.2","8.0","-145","+125","-1.5","+135","-160","-110","-110"`

    const report = evaluatePredictions(parsePredictionsCsv(predictionsCsv), [], DEFAULT_THRESHOLDS)

    expect(report.moneyline.pending).toBe(1)
    expect(report.runLine.pending).toBe(1)
    expect(report.totals.pending).toBe(1)
  })

  it('filters out bets that do not clear custom thresholds', () => {
    const predictionsCsv = `"Date","GameTime","Away","Home","LookupKey","AwayStarter","HomeStarter","AwayRuns","HomeRuns","Total","Margin","HomeWinProb","AwayWinProb","MoneylineRec","MoneylineEdgePct","RunLineRec","RunLineEdgePct","TotalRec","TotalEdgePct","MarketTotal","HomeML","AwayML","RunLine","RunLineHomeOdds","RunLineAwayOdds","OverOdds","UnderOdds"
"2026-03-25","7:10 PM","ATL","LAD","20260325LADATL","Chris Sale","Tyler Glasnow","3.90","4.80","8.70","0.90","59.2","40.8","HOME ML","4.1","HOME -1.5","3.9","OVER","5.2","8.0","-145","+125","-1.5","+135","-160","-110","-110"`
    const resultsCsv = `"Date","Away","Home","AwayScore","HomeScore","LookupKey"
"2026-03-25","ATL","LAD","3","6","20260325LADATL"`

    const report = evaluatePredictions(parsePredictionsCsv(predictionsCsv), parseResultsCsv(resultsCsv), {
      moneylineEdgePct: 5,
      runLineEdgePct: 4,
      totalEdgePct: 6,
    })

    expect(report.rows).toHaveLength(0)
  })
})
