import 'dotenv/config'

export type AppConfig = {
  databaseUrl: string | null
  apiPort: number
  exportDir: string
  sharpProvider: string
  oddsCaptureProvider: string
  oddsCaptureBaseUrl: string
  oddsCaptureLoginUrl: string | null
  oddsCapturePageUrl: string | null
  oddsCaptureUsername: string | null
  oddsCapturePassword: string | null
  oddsCaptureLoginFrameSelector: string | null
  oddsCaptureUsernameSelector: string | null
  oddsCapturePasswordSelector: string | null
  oddsCaptureSubmitSelector: string | null
  oddsCaptureSuccessSelector: string | null
  oddsCaptureContentSelector: string | null
  oddsCaptureReadySelector: string | null
  oddsCaptureModalCloseSelector: string | null
  oddsCapturePostLoginScript: string | null
  oddsCaptureNavSelectors: string[]
  oddsCaptureStepDelayMs: number
  oddsCaptureTypeDelayMs: number
  oddsCaptureUserAgent: string
  oddsCaptureBrowserChannel: string | null
  oddsCaptureHeadless: boolean
  oddsCaptureTimeoutMs: number
  enableDbPersistence: boolean
  enableFallbackMode: boolean
}

function readInt(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback
  const value = Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : fallback
}

function readBool(name: string, fallback: boolean) {
  const raw = process.env[name]
  if (!raw) return fallback
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())
}

function readString(name: string, fallback: string) {
  const raw = process.env[name]?.trim()
  return raw ? raw : fallback
}

function readStringList(name: string) {
  const raw = process.env[name]?.trim()
  if (!raw) return []
  return raw
    .split('||')
    .map((value) => value.trim())
    .filter(Boolean)
}

export const appConfig: AppConfig = {
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  apiPort: readInt('API_PORT', 8788),
  exportDir: readString('EXPORT_DIR', './generated'),
  sharpProvider: readString('SHARP_PROVIDER', 'espn-derived'),
  oddsCaptureProvider: readString('ODDS_CAPTURE_PROVIDER', 'playwright-site'),
  oddsCaptureBaseUrl: readString('ODDS_CAPTURE_BASE_URL', ''),
  oddsCaptureLoginUrl: process.env.ODDS_CAPTURE_LOGIN_URL?.trim() || null,
  oddsCapturePageUrl: process.env.ODDS_CAPTURE_PAGE_URL?.trim() || null,
  oddsCaptureUsername: process.env.ODDS_CAPTURE_USERNAME?.trim() || null,
  oddsCapturePassword: process.env.ODDS_CAPTURE_PASSWORD?.trim() || null,
  oddsCaptureLoginFrameSelector: process.env.ODDS_CAPTURE_LOGIN_FRAME_SELECTOR?.trim() || null,
  oddsCaptureUsernameSelector: process.env.ODDS_CAPTURE_USERNAME_SELECTOR?.trim() || null,
  oddsCapturePasswordSelector: process.env.ODDS_CAPTURE_PASSWORD_SELECTOR?.trim() || null,
  oddsCaptureSubmitSelector: process.env.ODDS_CAPTURE_SUBMIT_SELECTOR?.trim() || null,
  oddsCaptureSuccessSelector: process.env.ODDS_CAPTURE_SUCCESS_SELECTOR?.trim() || null,
  oddsCaptureContentSelector: process.env.ODDS_CAPTURE_CONTENT_SELECTOR?.trim() || null,
  oddsCaptureReadySelector: process.env.ODDS_CAPTURE_READY_SELECTOR?.trim() || null,
  oddsCaptureModalCloseSelector: process.env.ODDS_CAPTURE_MODAL_CLOSE_SELECTOR?.trim() || null,
  oddsCapturePostLoginScript: process.env.ODDS_CAPTURE_POST_LOGIN_SCRIPT?.trim() || null,
  oddsCaptureNavSelectors: readStringList('ODDS_CAPTURE_NAV_SELECTORS'),
  oddsCaptureStepDelayMs: readInt('ODDS_CAPTURE_STEP_DELAY_MS', 1000),
  oddsCaptureTypeDelayMs: readInt('ODDS_CAPTURE_TYPE_DELAY_MS', 75),
  oddsCaptureUserAgent: readString(
    'ODDS_CAPTURE_USER_AGENT',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
  ),
  oddsCaptureBrowserChannel: process.env.ODDS_CAPTURE_BROWSER_CHANNEL?.trim() || null,
  oddsCaptureHeadless: readBool('ODDS_CAPTURE_HEADLESS', true),
  oddsCaptureTimeoutMs: readInt('ODDS_CAPTURE_TIMEOUT_MS', 45000),
  enableDbPersistence: readBool('ENABLE_DB_PERSISTENCE', true),
  enableFallbackMode: readBool('ENABLE_FALLBACK_MODE', true),
}

export function assertDateInput(date: string | undefined, fallback = new Date().toISOString().slice(0, 10)) {
  const value = (date ?? fallback).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Expected date in YYYY-MM-DD format, received "${date ?? ''}".`)
  }
  return value
}

export function subtractOneDay(date: string) {
  const stamp = new Date(`${date}T12:00:00Z`)
  stamp.setUTCDate(stamp.getUTCDate() - 1)
  return stamp.toISOString().slice(0, 10)
}

export function isDbConfigured() {
  return Boolean(appConfig.databaseUrl) && appConfig.enableDbPersistence
}
