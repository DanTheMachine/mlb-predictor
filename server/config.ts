import 'dotenv/config'

export type AppConfig = {
  databaseUrl: string | null
  apiPort: number
  exportDir: string
  sharpProvider: string
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

export const appConfig: AppConfig = {
  databaseUrl: process.env.DATABASE_URL?.trim() || null,
  apiPort: readInt('API_PORT', 8788),
  exportDir: readString('EXPORT_DIR', './generated'),
  sharpProvider: readString('SHARP_PROVIDER', 'espn-derived'),
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
