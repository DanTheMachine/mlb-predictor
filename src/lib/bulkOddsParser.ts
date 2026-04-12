import type { OddsInput, TeamAbbr } from './mlbTypes'

export type ParsedBulkGame = {
  awayAbbr: TeamAbbr
  homeAbbr: TeamAbbr
  odds: OddsInput
}

const BULK_NAME_MAP: Record<string, TeamAbbr> = {
  'ARIZONA DIAMONDBACKS': 'ARI',
  ARIZONA: 'ARI',
  'ATLANTA BRAVES': 'ATL',
  ATLANTA: 'ATL',
  'BALTIMORE ORIOLES': 'BAL',
  BALTIMORE: 'BAL',
  'BOSTON RED SOX': 'BOS',
  BOSTON: 'BOS',
  'CHICAGO CUBS': 'CHC',
  CHICAGO: 'CHC',
  'CINCINNATI REDS': 'CIN',
  CINCINNATI: 'CIN',
  'CLEVELAND GUARDIANS': 'CLE',
  CLEVELAND: 'CLE',
  'COLORADO ROCKIES': 'COL',
  COLORADO: 'COL',
  'CHICAGO WHITE SOX': 'CWS',
  'WHITE SOX': 'CWS',
  DETROIT: 'DET',
  'DETROIT TIGERS': 'DET',
  HOUSTON: 'HOU',
  'HOUSTON ASTROS': 'HOU',
  'KANSAS CITY ROYALS': 'KC',
  'KANSAS CITY': 'KC',
  'LOS ANGELES ANGELS': 'LAA',
  'LA ANGELS': 'LAA',
  ANGELS: 'LAA',
  'LOS ANGELES DODGERS': 'LAD',
  'LA DODGERS': 'LAD',
  DODGERS: 'LAD',
  MIAMI: 'MIA',
  'MIAMI MARLINS': 'MIA',
  MILWAUKEE: 'MIL',
  'MILWAUKEE BREWERS': 'MIL',
  MINNESOTA: 'MIN',
  'MINNESOTA TWINS': 'MIN',
  'NEW YORK METS': 'NYM',
  'NY METS': 'NYM',
  METS: 'NYM',
  'NEW YORK YANKEES': 'NYY',
  'NY YANKEES': 'NYY',
  YANKEES: 'NYY',
  'OAKLAND ATHLETICS': 'OAK',
  OAKLAND: 'OAK',
  ATHLETICS: 'OAK',
  PHILADELPHIA: 'PHI',
  PHILLIES: 'PHI',
  'PHILADELPHIA PHILLIES': 'PHI',
  PITTSBURGH: 'PIT',
  'PITTSBURGH PIRATES': 'PIT',
  'SAN DIEGO PADRES': 'SD',
  'SAN DIEGO': 'SD',
  PADRES: 'SD',
  SEATTLE: 'SEA',
  'SEATTLE MARINERS': 'SEA',
  'SAN FRANCISCO GIANTS': 'SF',
  'SAN FRANCISCO': 'SF',
  GIANTS: 'SF',
  'ST. LOUIS CARDINALS': 'STL',
  'SAINT LOUIS CARDINALS': 'STL',
  'ST LOUIS': 'STL',
  CARDINALS: 'STL',
  'TAMPA BAY RAYS': 'TB',
  'TAMPA BAY': 'TB',
  RAYS: 'TB',
  TEXAS: 'TEX',
  'TEXAS RANGERS': 'TEX',
  TORONTO: 'TOR',
  'TORONTO BLUE JAYS': 'TOR',
  'BLUE JAYS': 'TOR',
  WASHINGTON: 'WSH',
  'WASHINGTON NATIONALS': 'WSH',
  NATIONALS: 'WSH',
}

const TEAM_NAME_PATTERNS = Object.keys(BULK_NAME_MAP)
  .sort((left, right) => right.length - left.length)
  .map((value) => escapeRegex(value))

const TEAM_NAME_REGEX = new RegExp(`\\b(?:${TEAM_NAME_PATTERNS.join('|')})\\b`, 'gi')
const BLOCK_TOKEN_REGEX = /(?:[OoUu]\s*\d+(?:\s*\.\d+)?|[+-]\s*\d+(?:\s*\.\d+)?|even|\d{3,4})/gi

const normalizeFractionGlyphs = (value: string): string =>
  value
    .trim()
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s*ÃƒÆ’Ã¢â‚¬Å¡?Ãƒâ€šÃ‚Â½/g, '.5')
    .replace(/\s*ÃƒÆ’Ã¢â‚¬Å¡?Ãƒâ€šÃ‚Â¼/g, '.25')
    .replace(/\s*ÃƒÆ’Ã¢â‚¬Å¡?Ãƒâ€šÃ‚Â¾/g, '.75')
    .replace(/\s*Ã‚Â½/g, '.5')
    .replace(/\s*Ã‚Â¼/g, '.25')
    .replace(/\s*Ã‚Â¾/g, '.75')
    .replace(/\s*Â½/g, '.5')
    .replace(/\s*Â¼/g, '.25')
    .replace(/\s*Â¾/g, '.75')
    .replace(/\s*½/g, '.5')
    .replace(/\s*¼/g, '.25')
    .replace(/\s*¾/g, '.75')
    .replace(/\s+1\/2\b/g, '.5')
    .replace(/\s+1\/4\b/g, '.25')
    .replace(/\s+3\/4\b/g, '.75')
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s+\.(25|5|75)\b/g, '$1.$2')

const parseOddsNum = (value: string | undefined): number | null => {
  if (!value) return null
  const clean = normalizeFractionGlyphs(value)
  if (/^even$/i.test(clean)) return 100
  const match = clean.match(/^([+-])\s*([\d.]+)$/i)
  if (!match) return null
  const sign = match[1]
  const amount = match[2]
  if (!sign || !amount) return null
  const numeric = Number.parseFloat(amount)
  return sign === '-' ? -numeric : numeric
}

const parseRunLine = (value: string | undefined): number | null => {
  if (!value) return null
  const clean = normalizeFractionGlyphs(value)
  const match = clean.match(/^([+-])\s*([\d.]+)$/)
  if (!match) return null
  const sign = match[1]
  const amount = match[2]
  if (!sign || !amount) return null
  const numeric = Number.parseFloat(amount)
  return sign === '-' ? -numeric : numeric
}

const parseTotal = (value: string | undefined): number | null => {
  if (!value) return null
  const clean = normalizeFractionGlyphs(value)
  const match = clean.match(/^[OoUu]\s*([\d.]+)$/)
  if (!match) return null
  const amount = match[1]
  return amount ? Number.parseFloat(amount) : null
}

export function parseBulkOdds(raw: string): ParsedBulkGame[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => normalizeFractionGlyphs(line))
    .filter(Boolean)

  const teamIndices = lines.flatMap((line, index) => (BULK_NAME_MAP[line.toUpperCase()] ? [index] : []))
  if (teamIndices.length >= 2) {
    return parseLineBlocks(lines, teamIndices)
  }

  const normalizedRaw = normalizeCapturedOddsText(raw)
  const teamMatches = [...normalizedRaw.matchAll(TEAM_NAME_REGEX)]
  if (teamMatches.length < 2) {
    throw new Error('Could not find recognizable MLB team names in the paste block.')
  }

  const games: ParsedBulkGame[] = []
  for (let i = 0; i < teamMatches.length - 1; i += 2) {
    const awayMatch = teamMatches[i]
    const homeMatch = teamMatches[i + 1]
    if (!awayMatch || !homeMatch) continue

    const awayAbbr = BULK_NAME_MAP[awayMatch[0].toUpperCase()]
    const homeAbbr = BULK_NAME_MAP[homeMatch[0].toUpperCase()]
    if (!awayAbbr || !homeAbbr) continue

    const awayStart = (awayMatch.index ?? 0) + awayMatch[0].length
    const homeStart = homeMatch.index ?? 0
    const nextBoundary = teamMatches[i + 2]?.index ?? normalizedRaw.length

    const awayBlock = extractBlockTokens(normalizedRaw.slice(awayStart, homeStart))
    const homeBlock = extractBlockTokens(normalizedRaw.slice(homeStart + homeMatch[0].length, nextBoundary))

    const [awayRunLineRaw, awayRunLineOddsRaw, awayTotalRaw, awayOverOddsRaw, awayMoneylineRaw] = awayBlock
    const [homeRunLineRaw, homeRunLineOddsRaw, homeTotalRaw, homeUnderOddsRaw, homeMoneylineRaw] = homeBlock

    const awayRunLine = parseRunLine(awayRunLineRaw)
    const homeRunLine = parseRunLine(homeRunLineRaw) ?? (awayRunLine != null ? -awayRunLine : null)
    const total = parseTotal(awayTotalRaw) ?? parseTotal(homeTotalRaw)

    games.push({
      awayAbbr,
      homeAbbr,
      odds: {
        source: 'manual',
        awayMoneyline: parseOddsNum(awayMoneylineRaw) ?? 110,
        homeMoneyline: parseOddsNum(homeMoneylineRaw) ?? -130,
        runLine: homeRunLine ?? -1.5,
        runLineAwayOdds: parseOddsNum(awayRunLineOddsRaw) ?? -110,
        runLineHomeOdds: parseOddsNum(homeRunLineOddsRaw) ?? 135,
        overUnder: total ?? 8,
        overOdds: parseOddsNum(awayOverOddsRaw) ?? -110,
        underOdds: parseOddsNum(homeUnderOddsRaw) ?? -110,
      },
    })
  }

  return games
}

function parseLineBlocks(lines: string[], teamIndices: number[]) {
  const games: ParsedBulkGame[] = []

  for (let i = 0; i < teamIndices.length - 1; i += 2) {
    const awayIndex = teamIndices[i]
    const homeIndex = teamIndices[i + 1]
    if (awayIndex == null || homeIndex == null) continue

    const awayAbbr = BULK_NAME_MAP[lines[awayIndex]!.toUpperCase()]
    const homeAbbr = BULK_NAME_MAP[lines[homeIndex]!.toUpperCase()]
    if (!awayAbbr || !homeAbbr) continue

    const awayBlock = sliceBlock(lines, awayIndex + 1, homeIndex)
    const nextBoundary = teamIndices[i + 2] ?? lines.length
    const homeBlock = sliceBlock(lines, homeIndex + 1, nextBoundary)

    games.push(buildParsedGame(awayAbbr, homeAbbr, awayBlock, homeBlock))
  }

  return games
}

function buildParsedGame(awayAbbr: TeamAbbr, homeAbbr: TeamAbbr, awayBlock: string[], homeBlock: string[]): ParsedBulkGame {
  const [awayRunLineRaw, awayRunLineOddsRaw, awayTotalRaw, awayOverOddsRaw, awayMoneylineRaw] = awayBlock
  const [homeRunLineRaw, homeRunLineOddsRaw, homeTotalRaw, homeUnderOddsRaw, homeMoneylineRaw] = homeBlock

  const awayRunLine = parseRunLine(awayRunLineRaw)
  const homeRunLine = parseRunLine(homeRunLineRaw) ?? (awayRunLine != null ? -awayRunLine : null)
  const total = parseTotal(awayTotalRaw) ?? parseTotal(homeTotalRaw)

  return {
    awayAbbr,
    homeAbbr,
    odds: {
      source: 'manual',
      awayMoneyline: parseOddsNum(awayMoneylineRaw) ?? 110,
      homeMoneyline: parseOddsNum(homeMoneylineRaw) ?? -130,
      runLine: homeRunLine ?? -1.5,
      runLineAwayOdds: parseOddsNum(awayRunLineOddsRaw) ?? -110,
      runLineHomeOdds: parseOddsNum(homeRunLineOddsRaw) ?? 135,
      overUnder: total ?? 8,
      overOdds: parseOddsNum(awayOverOddsRaw) ?? -110,
      underOdds: parseOddsNum(homeUnderOddsRaw) ?? -110,
    },
  }
}

function normalizeCapturedOddsText(raw: string) {
  return normalizeFractionGlyphs(raw)
    .replace(/\r/g, '\n')
    .replace(/\t/g, '\n')
    .replace(/\s+\|\s+/g, '\n')
    .replace(/\s{2,}/g, ' ')
}

function extractBlockTokens(block: string): string[] {
  const tokens = [...block.matchAll(BLOCK_TOKEN_REGEX)].map((match) => normalizeFractionGlyphs(match[0]))
  if (tokens[0] && /^\d{3,4}$/.test(tokens[0])) {
    tokens.shift()
  }
  return tokens.slice(0, 5)
}

function sliceBlock(lines: string[], start: number, end: number): string[] {
  const result: string[] = []
  let cursor = start
  if (cursor < end && /^\d{3,4}$/.test(lines[cursor] ?? '')) {
    cursor += 1
  }
  while (cursor < end && result.length < 5) {
    const line = lines[cursor]
    if (line) result.push(line)
    cursor += 1
  }
  return result
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
