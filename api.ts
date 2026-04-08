import express from 'express'

import { appConfig, assertDateInput } from './server/config.js'
import {
  evaluate,
  exportPredictionsCsv,
  exportResultsCsv,
  generatePredictions,
  getLatestRuns,
  getStoredPredictions,
  getStoredResults,
  ingestResults,
} from './server/services/mlbAutomation.js'

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mlb-automation-api' })
})

app.get('/api/automation/runs/latest', async (req, res) => {
  try {
    const limit = Number.parseInt(String(req.query.limit ?? '10'), 10)
    res.json(await getLatestRuns(Number.isFinite(limit) ? limit : 10))
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to load runs.' })
  }
})

app.get('/api/automation/predictions', async (req, res) => {
  try {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined
    const date = typeof req.query.date === 'string' ? assertDateInput(req.query.date) : undefined
    res.json(await getStoredPredictions({ runId, date }))
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to load predictions.' })
  }
})

app.get('/api/automation/results', async (req, res) => {
  try {
    const from = assertDateInput(typeof req.query.from === 'string' ? req.query.from : undefined)
    const to = assertDateInput(typeof req.query.to === 'string' ? req.query.to : from, from)
    res.json(await getStoredResults(from, to))
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to load results.' })
  }
})

app.get('/api/automation/evaluation', async (req, res) => {
  try {
    const from = assertDateInput(typeof req.query.from === 'string' ? req.query.from : undefined)
    const to = assertDateInput(typeof req.query.to === 'string' ? req.query.to : from, from)
    res.json(await evaluate({ from, to }))
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Failed to evaluate.' })
  }
})

app.post('/api/automation/predictions/run', async (req, res) => {
  try {
    const date = assertDateInput(typeof req.body?.date === 'string' ? req.body.date : undefined)
    res.json(await generatePredictions(date))
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Prediction run failed.' })
  }
})

app.post('/api/automation/results/ingest', async (req, res) => {
  try {
    const date = assertDateInput(typeof req.body?.date === 'string' ? req.body.date : undefined)
    res.json(await ingestResults(date))
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Result ingestion failed.' })
  }
})

app.get('/api/automation/exports/predictions', async (req, res) => {
  try {
    const runId = typeof req.query.runId === 'string' ? req.query.runId : undefined
    const date = typeof req.query.date === 'string' ? assertDateInput(req.query.date) : undefined
    const exportResult = await exportPredictionsCsv({ runId, date })
    res.type('text/csv').send(exportResult.csv)
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Prediction export failed.' })
  }
})

app.get('/api/automation/exports/results', async (req, res) => {
  try {
    const date = assertDateInput(typeof req.query.date === 'string' ? req.query.date : undefined)
    const exportResult = await exportResultsCsv(date)
    res.type('text/csv').send(exportResult.csv)
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'Results export failed.' })
  }
})

app.listen(appConfig.apiPort, () => {
  console.log(`MLB automation API listening on ${appConfig.apiPort}`)
})
