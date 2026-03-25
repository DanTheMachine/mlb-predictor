import { createDefaultBullpenWorkload, getDefaultStarter, getStartersForTeam, TEAMS } from './mlbModel'
import { PROXY_BASE_URL } from './proxyConfig'
import { buildTeamRatingsFromStats, type TeamStatMap } from './teamRatings'
import type {
  AvailabilityNote,
  LineupConfidence,
  OddsInput,
  RecentFormSummary,
  ScheduleRow,
  StarterStats,
  TeamAbbr,
  TeamStats,
  WindDirection,
} from './mlbTypes'

export type GradingResultRow = {
  date: string
  away: TeamAbbr
  home: TeamAbbr
  awayScore: number
  homeScore: number
  lookupKey: string
}

export type TeamRatingsSnapshot = {
  teams: Record<TeamAbbr, TeamStats>
  sourceSeason: number
  fetchedAt: string
}

type LiveTeam = {
  id?: number
  abbreviation?: string
  teamCode?: string
  name?: string
}

type LivePitcher = {
  fullName?: string
  pitchingHand?: {
    code?: string
  }
}

type LiveGame = {
  gamePk?: number
  gameDate?: string
  status?: {
    detailedState?: string
    abstractGameState?: string
  }
  teams?: {
    away?: {
      team?: LiveTeam
      probablePitcher?: LivePitcher
      score?: number
    }
    home?: {
      team?: LiveTeam
      probablePitcher?: LivePitcher
      score?: number
    }
  }
}

type LiveScheduleResponse = {
  dates?: Array<{
    games?: LiveGame[]
  }>
}

type TeamStatsResponse = {
  stats?: Array<{
    splits?: Array<{
      team?: LiveTeam
      stat?: Record<string, number | string | undefined>
    }>
  }>
}

type EspnEvent = {
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: 'home' | 'away'
      team?: {
        abbreviation?: string
      }
    }>
    odds?: Array<{
      moneyline?: {
        home?: { close?: { odds?: string }; open?: { odds?: string } }
        away?: { close?: { odds?: string }; open?: { odds?: string } }
      }
      pointSpread?: {
        home?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } }
        away?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } }
      }
      total?: {
        over?: { close?: { line?: string; odds?: string }; open?: { line?: string; odds?: string } }
        under?: { close?: { odds?: string }; open?: { odds?: string } }
      }
    }>
  }>
}

type EspnScoreboardResponse = {
  events?: EspnEvent[]
}

type WeatherResponse = {
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    wind_speed_10m?: number[]
    wind_direction_10m?: number[]
    weather_code?: number[]
  }
}

type WeatherSnapshot = {
  temperature: number
  windMph: number
  windDirection: WindDirection
  summary: string
}

type BoxscoreTeam = {
  batters?: number[]
  players?: Record<string, { battingOrder?: string }>
}

type BoxscoreResponse = {
  teams?: {
    away?: BoxscoreTeam
    home?: BoxscoreTeam
  }
}

type LineupSnapshot = {
  awayConfidence: LineupConfidence
  homeConfidence: LineupConfidence
  awayNote: string
  homeNote: string
}

// eslint-disable-next-line no-unused-vars
type WeatherFetcher = (homeTeam: TeamAbbr, gameDate: string) => Promise<WeatherSnapshot | null>
// eslint-disable-next-line no-unused-vars
type ScheduleFetcher = (date: string) => Promise<LiveScheduleResponse>
// eslint-disable-next-line no-unused-vars
type LineupFetcher = (gamePk: number) => Promise<LineupSnapshot | null>
// eslint-disable-next-line no-unused-vars
type OddsFetcher = (date: string) => Promise<Partial<Record<string, OddsInput>>>

const TEAM_ID_MAP: Record<number, TeamAbbr> = {
  108: 'LAA',
  109: 'ARI',
  110: 'BAL',
  111: 'BOS',
  112: 'CHC',
  113: 'CIN',
  114: 'CLE',
  115: 'COL',
  116: 'DET',
  117: 'HOU',
  118: 'KC',
  119: 'LAD',
  120: 'WSH',
  121: 'NYM',
  133: 'OAK',
  134: 'PIT',
  135: 'SD',
  136: 'SEA',
  137: 'SF',
  138: 'STL',
  139: 'TB',
  140: 'TEX',
  141: 'TOR',
  142: 'MIN',
  143: 'PHI',
  144: 'ATL',
  145: 'CWS',
  146: 'MIA',
  147: 'NYY',
  158: 'MIL',
}

const TEAM_NAME_MAP: Record<string, TeamAbbr> = {
  ANGELS: 'LAA',
  ARIZONADIAMONDBACKS: 'ARI',
  ATHLETICS: 'OAK',
  ATLANTABRAVES: 'ATL',
  ASTROS: 'HOU',
  BALTIMOREORIOLES: 'BAL',
  BOSTONREDSOX: 'BOS',
  BLUEJAYS: 'TOR',
  CHICAGOCUBS: 'CHC',
  CHICAGOWHITESOX: 'CWS',
  CINCINNATIREDS: 'CIN',
  CLEVELANDGUARDIANS: 'CLE',
  COLORADOROCKIES: 'COL',
  BRAVES: 'ATL',
  BREWERS: 'MIL',
  DETROITTIGERS: 'DET',
  HOUSTONASTROS: 'HOU',
  KANSASCITYROYALS: 'KC',
  LOSANGELESANGELS: 'LAA',
  LOSANGELESDODGERS: 'LAD',
  MIAMIMARLINS: 'MIA',
  MILWAUKEEBREWERS: 'MIL',
  MINNESOTATWINS: 'MIN',
  NEWYORKMETS: 'NYM',
  NEWYORKYANKEES: 'NYY',
  OAKLANDATHLETICS: 'OAK',
  PHILADELPHIAPHILLIES: 'PHI',
  PITTSBURGHPIRATES: 'PIT',
  SANDIEGOPADRES: 'SD',
  SANFRANCISCOGIANTS: 'SF',
  SEATTLEMARINERS: 'SEA',
  STLOUISCARDINALS: 'STL',
  TAMPABAYRAYS: 'TB',
  TEXASRANGERS: 'TEX',
  TORONTOBLUEJAYS: 'TOR',
  WASHINGTONNATIONALS: 'WSH',
  CARDINALS: 'STL',
  CUBS: 'CHC',
  DBACKS: 'ARI',
  DIAMONDBACKS: 'ARI',
  DODGERS: 'LAD',
  GIANTS: 'SF',
  GUARDIANS: 'CLE',
  MARINERS: 'SEA',
  MARLINS: 'MIA',
  METS: 'NYM',
  NATIONALS: 'WSH',
  ORIOLES: 'BAL',
  PADRES: 'SD',
  PHILLIES: 'PHI',
  PIRATES: 'PIT',
  RANGERS: 'TEX',
  RAYS: 'TB',
  REDS: 'CIN',
  REDSOX: 'BOS',
  ROCKIES: 'COL',
  ROYALS: 'KC',
  TIGERS: 'DET',
  TWINS: 'MIN',
  WHITESOX: 'CWS',
  YANKEES: 'NYY',
}

const TEAM_CODE_MAP: Record<string, TeamAbbr> = {
  ANA: 'LAA',
  ARI: 'ARI',
  ATL: 'ATL',
  AZ: 'ARI',
  BAL: 'BAL',
  BOS: 'BOS',
  CHC: 'CHC',
  CIN: 'CIN',
  CLE: 'CLE',
  CWS: 'CWS',
  DET: 'DET',
  HOU: 'HOU',
  KC: 'KC',
  KCR: 'KC',
  LAA: 'LAA',
  LAD: 'LAD',
  MIA: 'MIA',
  MIL: 'MIL',
  MIN: 'MIN',
  NYM: 'NYM',
  NYY: 'NYY',
  OAK: 'OAK',
  ATH: 'OAK',
  PHI: 'PHI',
  PIT: 'PIT',
  SD: 'SD',
  SDP: 'SD',
  SEA: 'SEA',
  SF: 'SF',
  SFG: 'SF',
  STL: 'STL',
  TB: 'TB',
  TBR: 'TB',
  TEX: 'TEX',
  TOR: 'TOR',
  WSH: 'WSH',
}

const STADIUM_COORDS: Record<TeamAbbr, { lat: number; lon: number }> = {
  ARI: { lat: 33.4455, lon: -112.0667 },
  ATL: { lat: 33.8907, lon: -84.4677 },
  BAL: { lat: 39.2838, lon: -76.6217 },
  BOS: { lat: 42.3467, lon: -71.0972 },
  CHC: { lat: 41.9484, lon: -87.6553 },
  CIN: { lat: 39.0979, lon: -84.5081 },
  CLE: { lat: 41.4962, lon: -81.6852 },
  COL: { lat: 39.7559, lon: -104.9942 },
  CWS: { lat: 41.8301, lon: -87.6338 },
  DET: { lat: 42.339, lon: -83.0485 },
  HOU: { lat: 29.7573, lon: -95.3555 },
  KC: { lat: 39.0517, lon: -94.4803 },
  LAA: { lat: 33.8003, lon: -117.8827 },
  LAD: { lat: 34.0739, lon: -118.24 },
  MIA: { lat: 25.7781, lon: -80.2197 },
  MIL: { lat: 43.028, lon: -87.9712 },
  MIN: { lat: 44.9817, lon: -93.2776 },
  NYM: { lat: 40.7571, lon: -73.8458 },
  NYY: { lat: 40.8296, lon: -73.9262 },
  OAK: { lat: 37.7516, lon: -122.2005 },
  PHI: { lat: 39.9061, lon: -75.1665 },
  PIT: { lat: 40.4469, lon: -80.0057 },
  SD: { lat: 32.7076, lon: -117.157 },
  SEA: { lat: 47.5914, lon: -122.3325 },
  SF: { lat: 37.7786, lon: -122.3893 },
  STL: { lat: 38.6226, lon: -90.1928 },
  TB: { lat: 27.7682, lon: -82.6534 },
  TEX: { lat: 32.7473, lon: -97.0847 },
  TOR: { lat: 43.6414, lon: -79.3894 },
  WSH: { lat: 38.873, lon: -77.0074 },
}

export function normalizeMlbTeam(team: LiveTeam | undefined): TeamAbbr | null {
  if (!team) return null
  if (team.id) return TEAM_ID_MAP[team.id] ?? null

  const code = [team.abbreviation, team.teamCode]
    .map((value) => value?.toUpperCase().replace(/[^A-Z]/g, ''))
    .find((value): value is string => Boolean(value))
  if (code && TEAM_CODE_MAP[code]) return TEAM_CODE_MAP[code]

  const normalizedName = team.name?.toUpperCase().replace(/[^A-Z]/g, '')
  if (normalizedName && TEAM_NAME_MAP[normalizedName]) return TEAM_NAME_MAP[normalizedName]

  return null
}

export function resolveLiveStarter(team: TeamAbbr, probablePitcher: LivePitcher | undefined): StarterStats {
  const liveName = probablePitcher?.fullName?.trim()
  if (!liveName) return getDefaultStarter(team)

  const starters = getStartersForTeam(team)
  const exact = starters.find((starter) => starter.name.toLowerCase() === liveName.toLowerCase())
  if (exact) return exact

  const baseStarter = getDefaultStarter(team)
  const hand = probablePitcher?.pitchingHand?.code?.toUpperCase() === 'L' ? 'L' : 'R'

  return {
    ...baseStarter,
    id: `${team}-${liveName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name: liveName,
    hand,
  }
}

async function fetchSchedule(date: string): Promise<LiveScheduleResponse> {
  const response = await fetch(`${PROXY_BASE_URL}/mlb/schedule?date=${encodeURIComponent(date)}`)
  if (!response.ok) {
    throw new Error(`Live schedule request failed with ${response.status}. Start the proxy with npm run proxy.`)
  }
  return (await response.json()) as LiveScheduleResponse
}

async function fetchTeamStats(group: 'hitting' | 'pitching' | 'fielding', season: number, sitCodes?: string): Promise<TeamStatsResponse> {
  const query = new URLSearchParams({
    season: String(season),
    group,
    stats: sitCodes ? 'statSplits' : 'season',
  })
  if (sitCodes) query.set('sitCodes', sitCodes)

  const response = await fetch(`${PROXY_BASE_URL}/mlb/team-stats?${query.toString()}`)
  if (!response.ok) {
    throw new Error(`MLB team stats request failed with ${response.status}. Start the proxy with npm run proxy.`)
  }

  return (await response.json()) as TeamStatsResponse
}

async function fetchWeather(homeTeam: TeamAbbr, gameDate: string): Promise<WeatherSnapshot | null> {
  const coords = STADIUM_COORDS[homeTeam]
  if (!coords) return null

  const date = gameDate.slice(0, 10)
  const response = await fetch(
    `${PROXY_BASE_URL}/weather?lat=${encodeURIComponent(String(coords.lat))}&lon=${encodeURIComponent(String(coords.lon))}&date=${encodeURIComponent(date)}`,
  )
  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as WeatherResponse
  return extractWeatherSnapshot(payload, gameDate)
}

async function fetchLineup(gamePk: number): Promise<LineupSnapshot | null> {
  const response = await fetch(`${PROXY_BASE_URL}/mlb/game/${encodeURIComponent(String(gamePk))}/boxscore`)
  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as BoxscoreResponse
  return extractLineupSnapshot(payload)
}

async function fetchEspnOddsMap(date: string): Promise<Partial<Record<string, OddsInput>>> {
  const response = await fetch(`${PROXY_BASE_URL}/espn/mlb/scoreboard?date=${encodeURIComponent(toEspnDate(date))}`)
  if (!response.ok) {
    return {}
  }

  const payload = (await response.json()) as EspnScoreboardResponse
  const map: Partial<Record<string, OddsInput>> = {}

  for (const event of payload.events ?? []) {
    const parsed = parseOddsFromEspnEvent(event)
    if (!parsed) continue
    map[oddsLookupKey(parsed.homeTeam, parsed.awayTeam)] = parsed.odds
  }

  return map
}

export async function fetchLiveScheduleRows(
  date: string,
  options: {
    scheduleFetcher?: ScheduleFetcher
    weatherFetcher?: WeatherFetcher
    lineupFetcher?: LineupFetcher
    oddsFetcher?: OddsFetcher
  } = {},
): Promise<ScheduleRow[]> {
  const schedule = await (options.scheduleFetcher ?? fetchSchedule)(date)
  const games = schedule.dates?.flatMap((entry) => entry.games ?? []) ?? []
  const weatherFetcher = options.weatherFetcher ?? fetchWeather
  const lineupFetcher = options.lineupFetcher ?? fetchLineup
  const oddsMap = await (options.oddsFetcher ?? fetchEspnOddsMap)(date)

  const rows = await Promise.all(games.map(async (game) => buildLiveScheduleRow(game, weatherFetcher, lineupFetcher, oddsMap)))

  return rows.filter((row): row is ScheduleRow => row !== null)
}

export async function fetchMlbScheduleRows(date: string): Promise<ScheduleRow[]> {
  return fetchLiveScheduleRows(date, {
    weatherFetcher: async () => null,
    oddsFetcher: async () => ({}),
  })
}

export async function enrichScheduleRowsWithExternalData(rows: ScheduleRow[], date: string): Promise<ScheduleRow[]> {
  const oddsMap = await fetchEspnOddsMap(date)

  const enrichedRows = await Promise.all(
    rows.map(async (row) => {
      const gameDate = row.game.gameDateIso ?? `${date}T19:00:00Z`
      const weather = await fetchWeather(row.game.homeTeam, gameDate)
      const odds = oddsMap[oddsLookupKey(row.game.homeTeam, row.game.awayTeam)] ?? row.odds
      const now = new Date().toISOString()

      const weatherNote: AvailabilityNote = {
        team: row.game.homeTeam,
        note: weather ? `${row.game.homeTeam} weather feed: ${weather.summary}.` : `${row.game.homeTeam} weather feed unavailable; using current fallback conditions.`,
        impact: weather?.summary.includes('rain') ? 'high' : 'low',
        lastUpdated: now,
      }

      const availabilityNotes = [...row.availabilityNotes.filter((note) => !note.note.includes('weather feed:') && !note.note.includes('weather feed unavailable')), weatherNote]

      return {
        ...row,
        temperature: weather?.temperature ?? row.temperature,
        windMph: weather?.windMph ?? row.windMph,
        windDirection: weather?.windDirection ?? row.windDirection,
        weatherLastUpdated: weather ? now : row.weatherLastUpdated,
        availabilityNotes,
        odds,
      }
    }),
  )

  return enrichedRows
}

export async function fetchCompletedGameResults(date: string): Promise<GradingResultRow[]> {
  const schedule = await fetchSchedule(date)
  const games = schedule.dates?.flatMap((entry) => entry.games ?? []) ?? []

  return games
    .map((game) => toGradingResultRow(game, date))
    .filter((row): row is GradingResultRow => row !== null)
}

export async function fetchTeamRatings(season: number): Promise<TeamRatingsSnapshot> {
  const attemptedSeasons = [season, season - 1]

  for (const sourceSeason of attemptedSeasons) {
    const snapshot = await fetchTeamRatingsForSeason(sourceSeason)
    const completeCount = Object.values(snapshot.teams).filter((team) => team.offenseVsR !== TEAMS[team.abbr].offenseVsR || team.bullpen !== TEAMS[team.abbr].bullpen).length
    if (completeCount >= 20) {
      return snapshot
    }
  }

  throw new Error(`Unable to build MLB team ratings for ${season} or ${season - 1}.`)
}

async function buildLiveScheduleRow(
  game: LiveGame,
  weatherFetcher: WeatherFetcher,
  lineupFetcher: LineupFetcher,
  oddsMap: Partial<Record<string, OddsInput>>,
): Promise<ScheduleRow | null> {
  const awayTeam = normalizeMlbTeam(game.teams?.away?.team)
  const homeTeam = normalizeMlbTeam(game.teams?.home?.team)
  const gameDate = game.gameDate

  if (!awayTeam || !homeTeam || !gameDate) {
    return null
  }

  const now = new Date().toISOString()
  const weather = await weatherFetcher(homeTeam, gameDate)
  const lineup = game.gamePk ? await lineupFetcher(game.gamePk) : null
  const awayStarter = resolveLiveStarter(awayTeam, game.teams?.away?.probablePitcher)
  const homeStarter = resolveLiveStarter(homeTeam, game.teams?.home?.probablePitcher)
  const odds = oddsMap[oddsLookupKey(homeTeam, awayTeam)] ?? defaultOddsForGame(homeTeam, awayTeam)

  return {
    game: {
      awayTeam,
      homeTeam,
      gameTime: formatGameTime(gameDate),
      gameDateIso: gameDate,
    },
    awayStarter,
    homeStarter,
    starterLastUpdated: now,
    awayBullpenFatigue: 'Fresh',
    homeBullpenFatigue: 'Fresh',
    awayBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
    homeBullpenWorkload: createDefaultBullpenWorkload('Fresh'),
    awayLineupConfidence: lineup?.awayConfidence ?? 'Projected',
    homeLineupConfidence: lineup?.homeConfidence ?? 'Projected',
    lineupLastUpdated: lineup ? now : '',
    temperature: weather?.temperature ?? 72,
    windMph: weather?.windMph ?? 6,
    windDirection: weather?.windDirection ?? 'Neutral',
    weatherLastUpdated: weather ? now : '',
    availabilityNotes: buildAvailabilityNotes(awayTeam, homeTeam, weather?.summary, lineup),
    recentForm: buildRecentForm(awayTeam, homeTeam, now),
    sharpInput: null,
    compositeRecommendation: null,
    odds,
    result: null,
  }
}

function buildAvailabilityNotes(
  awayTeam: TeamAbbr,
  homeTeam: TeamAbbr,
  weatherSummary?: string,
  lineup?: LineupSnapshot | null,
): AvailabilityNote[] {
  return [
    {
      team: awayTeam,
      note: lineup?.awayNote ?? `${awayTeam} lineup still pending confirmation from live feeds.`,
      impact: lineup?.awayConfidence === 'Confirmed' ? 'low' : lineup?.awayConfidence === 'Thin' ? 'high' : 'medium',
      lastUpdated: new Date().toISOString(),
    },
    {
      team: homeTeam,
      note: lineup?.homeNote ?? `${homeTeam} lineup still pending confirmation from live feeds.`,
      impact: lineup?.homeConfidence === 'Confirmed' ? 'low' : lineup?.homeConfidence === 'Thin' ? 'high' : 'medium',
      lastUpdated: new Date().toISOString(),
    },
    {
      team: homeTeam,
      note: weatherSummary ? `${homeTeam} weather feed: ${weatherSummary}.` : `${homeTeam} weather feed unavailable; using neutral conditions.`,
      impact: weatherSummary?.includes('rain') ? 'high' : 'low',
      lastUpdated: new Date().toISOString(),
    },
  ]
}

async function fetchTeamRatingsForSeason(season: number): Promise<TeamRatingsSnapshot> {
  const [hitting, pitching, fielding, hittingVsR, hittingVsL] = await Promise.all([
    fetchTeamStats('hitting', season),
    fetchTeamStats('pitching', season),
    fetchTeamStats('fielding', season),
    fetchTeamStats('hitting', season, 'vr').catch(() => ({ stats: [] }) as TeamStatsResponse),
    fetchTeamStats('hitting', season, 'vl').catch(() => ({ stats: [] }) as TeamStatsResponse),
  ])

  return {
    teams: buildTeamRatingsFromStats({
      baseTeams: TEAMS,
      hitting: toTeamStatMap(hitting),
      hittingVsR: toTeamStatMap(hittingVsR),
      hittingVsL: toTeamStatMap(hittingVsL),
      pitching: toTeamStatMap(pitching),
      fielding: toTeamStatMap(fielding),
    }),
    sourceSeason: season,
    fetchedAt: new Date().toISOString(),
  }
}

function toGradingResultRow(game: LiveGame, fallbackDate: string): GradingResultRow | null {
  const away = normalizeMlbTeam(game.teams?.away?.team)
  const home = normalizeMlbTeam(game.teams?.home?.team)
  const awayScore = game.teams?.away?.score
  const homeScore = game.teams?.home?.score
  const state = `${game.status?.abstractGameState ?? ''} ${game.status?.detailedState ?? ''}`.trim().toLowerCase()
  const isFinal = state.includes('final') || state.includes('completed')

  if (!away || !home || !Number.isFinite(awayScore) || !Number.isFinite(homeScore) || !isFinal) {
    return null
  }

  const date = game.gameDate?.slice(0, 10) ?? fallbackDate

  return {
    date,
    away,
    home,
    awayScore: awayScore as number,
    homeScore: homeScore as number,
    lookupKey: `${date.replaceAll('-', '')}${home}${away}`,
  }
}

function buildRecentForm(awayTeam: TeamAbbr, homeTeam: TeamAbbr, lastUpdated: string): { away: RecentFormSummary; home: RecentFormSummary } {
  return {
    away: createRecentFormSummary(awayTeam, lastUpdated),
    home: createRecentFormSummary(homeTeam, lastUpdated),
  }
}

function createRecentFormSummary(team: TeamAbbr, lastUpdated: string): RecentFormSummary {
  const stats = TEAMS[team]
  const offenseRuns = ((stats.offenseVsR + stats.offenseVsL) / 200) * 4.35
  const prevention = 4.7 - (stats.defense - 100) * 0.05 - (stats.bullpen - 100) * 0.04
  const trend = stats.bullpen >= 102 ? 'bullpen entering in good shape' : stats.bullpen <= 97 ? 'bullpen depth still a question' : 'relief usage near baseline'

  return {
    team,
    last10Record: `${Math.max(4, Math.min(7, Math.round((stats.offenseVsR - 95) / 4)))}-${Math.max(3, Math.min(6, 10 - Math.max(4, Math.min(7, Math.round((stats.offenseVsR - 95) / 4)))))}`,
    runsScoredPerGame: Number(offenseRuns.toFixed(1)),
    runsAllowedPerGame: Number(prevention.toFixed(1)),
    bullpenTrend: trend,
    lastUpdated,
  }
}

export function extractWeatherSnapshot(payload: WeatherResponse, gameDate: string): WeatherSnapshot | null {
  const hourly = payload.hourly
  if (!hourly?.time?.length) return null

  const target = new Date(gameDate).getTime()
  let bestIndex = 0
  let bestDiff = Number.POSITIVE_INFINITY

  for (let index = 0; index < hourly.time.length; index += 1) {
    const value = hourly.time[index]
    if (!value) continue
    const stamp = parseWeatherTime(value).getTime()
    const diff = Math.abs(stamp - target)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIndex = index
    }
  }

  const temperature = hourly.temperature_2m?.[bestIndex]
  const windMph = hourly.wind_speed_10m?.[bestIndex]
  const weatherCode = hourly.weather_code?.[bestIndex]
  const windDegrees = hourly.wind_direction_10m?.[bestIndex]
  if (temperature == null || windMph == null) return null

  return {
    temperature: Math.round(temperature),
    windMph: Math.round(windMph),
    windDirection: toModelWindDirection(windMph, windDegrees),
    summary: describeWeather(weatherCode, windMph),
  }
}

export function extractLineupSnapshot(payload: BoxscoreResponse): LineupSnapshot | null {
  const awayCount = countConfirmedBatters(payload.teams?.away)
  const homeCount = countConfirmedBatters(payload.teams?.home)

  if (awayCount === 0 && homeCount === 0) {
    return null
  }

  return {
    awayConfidence: lineupConfidenceFromCount(awayCount),
    homeConfidence: lineupConfidenceFromCount(homeCount),
    awayNote: lineupNote('Away', awayCount),
    homeNote: lineupNote('Home', homeCount),
  }
}

export function parseOddsFromEspnEvent(event: EspnEvent): { homeTeam: TeamAbbr; awayTeam: TeamAbbr; odds: OddsInput } | null {
  const competition = event.competitions?.[0]
  const home = normalizeEspnAbbr(competition?.competitors?.find((entry) => entry.homeAway === 'home')?.team?.abbreviation)
  const away = normalizeEspnAbbr(competition?.competitors?.find((entry) => entry.homeAway === 'away')?.team?.abbreviation)

  if (!home || !away) return null

  const odds = competition?.odds?.[0]
  if (!odds) return null

  const homeMoneyline = parseEspnOdds(odds.moneyline?.home?.close?.odds ?? odds.moneyline?.home?.open?.odds)
  const awayMoneyline = parseEspnOdds(odds.moneyline?.away?.close?.odds ?? odds.moneyline?.away?.open?.odds)
  if (!homeMoneyline || !awayMoneyline) return null

  return {
    homeTeam: home,
    awayTeam: away,
    odds: {
      source: 'espn',
      homeMoneyline,
      awayMoneyline,
      runLine: parseFloat(odds.pointSpread?.home?.close?.line ?? odds.pointSpread?.home?.open?.line ?? '-1.5'),
      runLineHomeOdds: parseEspnOdds(odds.pointSpread?.home?.close?.odds ?? odds.pointSpread?.home?.open?.odds) ?? 135,
      runLineAwayOdds: parseEspnOdds(odds.pointSpread?.away?.close?.odds ?? odds.pointSpread?.away?.open?.odds) ?? -160,
      overUnder: parseFloat((odds.total?.over?.close?.line ?? odds.total?.over?.open?.line ?? '8').replace(/[ou]/gi, '')) || 8,
      overOdds: parseEspnOdds(odds.total?.over?.close?.odds ?? odds.total?.over?.open?.odds) ?? -110,
      underOdds: parseEspnOdds(odds.total?.under?.close?.odds ?? odds.total?.under?.open?.odds) ?? -110,
    },
  }
}

export async function fetchEspnGameOdds(homeTeam: TeamAbbr, awayTeam: TeamAbbr, date = new Date().toISOString().slice(0, 10)): Promise<OddsInput | null> {
  const response = await fetch(`${PROXY_BASE_URL}/espn/mlb/scoreboard?date=${encodeURIComponent(toEspnDate(date))}`)
  if (!response.ok) {
    throw new Error(`ESPN MLB scoreboard request failed with ${response.status}.`)
  }

  const payload = (await response.json()) as EspnScoreboardResponse
  for (const event of payload.events ?? []) {
    const parsed = parseOddsFromEspnEvent(event)
    if (parsed && parsed.homeTeam === homeTeam && parsed.awayTeam === awayTeam) {
      return parsed.odds
    }
  }

  return null
}

function countConfirmedBatters(team: BoxscoreTeam | undefined) {
  if (!team) return 0
  if (Array.isArray(team.batters) && team.batters.length) return team.batters.length

  return Object.values(team.players ?? {}).filter((player) => Boolean(player.battingOrder)).length
}

function parseEspnOdds(value: string | undefined) {
  if (!value) return null
  const parsed = Number.parseFloat(value.replace('+', ''))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeEspnAbbr(value: string | undefined): TeamAbbr | null {
  if (!value) return null
  return TEAM_CODE_MAP[value.toUpperCase()] ?? null
}

function toEspnDate(date: string) {
  return date.replaceAll('-', '')
}

function toTeamStatMap(payload: TeamStatsResponse): TeamStatMap {
  const splits = payload.stats?.flatMap((entry) => entry.splits ?? []) ?? []

  return Object.fromEntries(
    splits
      .map((split) => {
        const team = normalizeMlbTeam(split.team)
        if (!team || !split.stat) return null

        const stats = Object.fromEntries(
          Object.entries(split.stat)
            .map(([key, value]) => [key, Number.parseFloat(String(value))])
            .filter((entry) => Number.isFinite(entry[1])),
        )

        return [team, stats]
      })
      .filter((entry): entry is [TeamAbbr, Record<string, number>] => Boolean(entry)),
  ) as TeamStatMap
}

function oddsLookupKey(homeTeam: TeamAbbr, awayTeam: TeamAbbr) {
  return `${homeTeam}-${awayTeam}`
}

function lineupConfidenceFromCount(count: number): LineupConfidence {
  if (count >= 9) return 'Confirmed'
  if (count >= 1) return 'Thin'
  return 'Projected'
}

function lineupNote(side: 'Away' | 'Home', count: number) {
  if (count >= 9) return `${side} lineup confirmed via MLB boxscore with ${count} hitters listed.`
  if (count >= 1) return `${side} lineup only partially posted via MLB boxscore (${count} hitters listed).`
  return `${side} lineup not yet posted via MLB boxscore.`
}

function parseWeatherTime(value: string) {
  return new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`)
}

function toModelWindDirection(windMph: number, windDegrees?: number): WindDirection {
  if (windMph < 7) return 'Neutral'
  if (windDegrees == null) return windMph >= 12 ? 'Cross' : 'Neutral'
  const normalized = ((windDegrees % 360) + 360) % 360
  if (normalized >= 45 && normalized < 135) return 'Out'
  if (normalized >= 225 && normalized < 315) return 'In'
  return 'Cross'
}

function describeWeather(weatherCode?: number, windMph?: number) {
  const rainLike = weatherCode != null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)
  const windy = (windMph ?? 0) >= 14
  if (rainLike && windy) return 'rain risk with playable wind'
  if (rainLike) return 'rain risk in forecast'
  if (windy) return `windy conditions around ${Math.round(windMph ?? 0)} mph`
  return 'temperate outdoor conditions'
}

function formatGameTime(gameDate: string) {
  return new Date(gameDate).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function defaultOddsForGame(homeTeam: TeamAbbr, awayTeam: TeamAbbr): OddsInput {
  const homeStrength = TEAMS[homeTeam].offenseVsR + TEAMS[homeTeam].bullpen + TEAMS[homeTeam].defense
  const awayStrength = TEAMS[awayTeam].offenseVsR + TEAMS[awayTeam].bullpen + TEAMS[awayTeam].defense
  const diff = homeStrength - awayStrength
  const homeMoneyline = diff >= 0 ? -Math.max(120, 130 + Math.round(diff * 1.1)) : 110 + Math.round(Math.abs(diff) * 0.8)
  const awayMoneyline = homeMoneyline < 0 ? 100 + Math.round(Math.abs(homeMoneyline) * 0.85) : -Math.max(120, 130 + Math.round(Math.abs(diff) * 0.7))

  return {
    source: 'model',
    homeMoneyline,
    awayMoneyline,
    runLine: -1.5,
    runLineHomeOdds: 135,
    runLineAwayOdds: -160,
    overUnder: 8,
    overOdds: -110,
    underOdds: -110,
  }
}
