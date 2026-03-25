import express from 'express'
import fetch from 'node-fetch'

const app = express()
const port = Number(process.env.PORT ?? 8787)

function applyCors(res: express.Response) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

async function proxyJson(res: express.Response, url: string) {
  const upstream = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'mlb-predictor-proxy/1.0',
    },
  })

  if (!upstream.ok) {
    const detail = await upstream.text()
    res.status(upstream.status).json({
      ok: false,
      error: `Upstream request failed with ${upstream.status}`,
      detail: detail.slice(0, 300),
    })
    return
  }

  const data = await upstream.json()
  res.json(data)
}

app.use((_req, res, next) => {
  applyCors(res)
  next()
})

app.options(/.*/, (_req, res) => {
  applyCors(res)
  res.status(204).end()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mlb-predictor-proxy' })
})

app.get('/mlb/schedule', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ ok: false, error: 'Expected date query in YYYY-MM-DD format.' })
    return
  }

  try {
    const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${encodeURIComponent(date)}&hydrate=probablePitcher,linescore`
    await proxyJson(res, url)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'MLB schedule fetch failed.',
    })
  }
})

app.get('/mlb/team-stats', async (req, res) => {
  const season = typeof req.query.season === 'string' ? req.query.season : ''
  const group = typeof req.query.group === 'string' ? req.query.group : ''
  const stats = typeof req.query.stats === 'string' ? req.query.stats : 'season'
  const sitCodes = typeof req.query.sitCodes === 'string' ? req.query.sitCodes : ''

  if (!/^\d{4}$/.test(season)) {
    res.status(400).json({ ok: false, error: 'Expected season query in YYYY format.' })
    return
  }

  if (!['hitting', 'pitching', 'fielding'].includes(group)) {
    res.status(400).json({ ok: false, error: 'Expected group query of hitting, pitching, or fielding.' })
    return
  }

  try {
    const url =
      `https://statsapi.mlb.com/api/v1/teams/stats?sportIds=1&season=${encodeURIComponent(season)}` +
      `&group=${encodeURIComponent(group)}` +
      `&stats=${encodeURIComponent(stats)}` +
      (sitCodes ? `&sitCodes=${encodeURIComponent(sitCodes)}` : '')
    await proxyJson(res, url)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'MLB team stats fetch failed.',
    })
  }
})

app.get('/espn/mlb/scoreboard', async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : ''
  if (!/^\d{8}$/.test(date)) {
    res.status(400).json({ ok: false, error: 'Expected date query in YYYYMMDD format.' })
    return
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${encodeURIComponent(date)}`
    await proxyJson(res, url)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'ESPN MLB scoreboard fetch failed.',
    })
  }
})

app.get('/mlb/game/:gamePk/boxscore', async (req, res) => {
  const gamePk = Number(req.params.gamePk)
  if (!Number.isInteger(gamePk) || gamePk <= 0) {
    res.status(400).json({ ok: false, error: 'Expected a positive numeric gamePk.' })
    return
  }

  try {
    const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`
    await proxyJson(res, url)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'MLB boxscore fetch failed.',
    })
  }
})

app.get('/weather', async (req, res) => {
  const lat = Number(req.query.lat)
  const lon = Number(req.query.lon)
  const date = typeof req.query.date === 'string' ? req.query.date : ''

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ ok: false, error: 'Expected numeric lat and lon query params.' })
    return
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ ok: false, error: 'Expected date query in YYYY-MM-DD format.' })
    return
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}` +
      `&longitude=${encodeURIComponent(String(lon))}` +
      `&start_date=${encodeURIComponent(date)}` +
      `&end_date=${encodeURIComponent(date)}` +
      '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code' +
      '&wind_speed_unit=mph&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=GMT'
    await proxyJson(res, url)
  } catch (error) {
    res.status(502).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Weather fetch failed.',
    })
  }
})

app.listen(port, () => {
  console.log(`MLB predictor proxy listening on ${port}`)
})
