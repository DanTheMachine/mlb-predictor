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

const normalizeFractionGlyphs = (value: string): string =>
  value
    .trim()
    .replace(/\s*[Ãƒâ€š]?Ã‚Â½/g, '.5')
    .replace(/\s*[Ãƒâ€š]?Ã‚Â¼/g, '.25')
    .replace(/\s*[Ãƒâ€š]?Ã‚Â¾/g, '.75')
    .replace(/\s*Â½/g, '.5')
    .replace(/\s*Â¼/g, '.25')
    .replace(/\s*Â¾/g, '.75')
    .replace(/\s*½/g, '.5')
    .replace(/\s*¼/g, '.25')
    .replace(/\s*¾/g, '.75')
    .replace(/\s+/g, ' ')

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
    .map((line) => line.trim())
    .filter(Boolean)

  const teamIndices = lines.flatMap((line, index) => (BULK_NAME_MAP[line.toUpperCase()] ? [index] : []))
  if (teamIndices.length < 2) {
    throw new Error('Could not find recognizable MLB team names in the paste block.')
  }

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
