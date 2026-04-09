import { readFile } from 'node:fs/promises'

import { parseBulkOdds } from '../../src/lib/bulkOddsParser.js'
import type { OddsInput, TeamAbbr } from '../../src/lib/mlbTypes.js'
import { assertDateInput } from '../config.js'
import { listOddsOverridesByDate, saveOddsOverrides, updateOddsOverrideStatus } from '../db/repositories.js'

export type PersistedOddsOverride = {
  date: string
  lookupKey: string
  awayTeam: TeamAbbr
  homeTeam: TeamAbbr
  source: string
  status: string
  odds: OddsInput
  metadata?: Record<string, unknown> | null
}

export async function importBulkOddsOverridesFromFile(args: { date?: string; file: string; source?: string }) {
  const date = assertDateInput(args.date)
  const source = (args.source ?? 'manual-paste').trim() || 'manual-paste'
  const raw = await readFile(args.file, 'utf8')
  return importBulkOddsOverrides({ date, raw, source, metadata: { file: args.file } })
}

export async function importBulkOddsOverrides(args: {
  date: string
  raw: string
  source?: string
  metadata?: Record<string, unknown>
}) {
  const date = assertDateInput(args.date)
  const source = (args.source ?? 'manual-paste').trim() || 'manual-paste'
  const parsed = parseBulkOdds(args.raw)

  const rows = parsed.map((game) => ({
    lookupKey: buildLookupKey(date, game.homeAbbr, game.awayAbbr),
    awayTeam: game.awayAbbr,
    homeTeam: game.homeAbbr,
    source,
    status: 'staged',
    odds: game.odds,
    metadata: args.metadata ?? null,
  }))

  await saveOddsOverrides(date, rows)

  return {
    date,
    source,
    importedCount: rows.length,
    lookupKeys: rows.map((row) => row.lookupKey),
  }
}

export async function listOddsOverrides(dateInput?: string) {
  const date = assertDateInput(dateInput)
  const rows = await listOddsOverridesByDate(date)
  return rows.map(
    (row) =>
      ({
        date,
        lookupKey: row.lookupKey,
        awayTeam: row.awayTeam as TeamAbbr,
        homeTeam: row.homeTeam as TeamAbbr,
        source: row.source,
        status: row.status,
        odds: row.odds as unknown as OddsInput,
        metadata: row.metadata as Record<string, unknown> | null,
      }) satisfies PersistedOddsOverride,
  )
}

export async function approveOddsOverrides(args: { date?: string; source?: string; lookupKeys?: string[] }) {
  return setOddsOverrideStatus({
    date: args.date,
    source: args.source,
    lookupKeys: args.lookupKeys,
    status: 'approved',
  })
}

export async function rejectOddsOverrides(args: { date?: string; source?: string; lookupKeys?: string[] }) {
  return setOddsOverrideStatus({
    date: args.date,
    source: args.source,
    lookupKeys: args.lookupKeys,
    status: 'rejected',
  })
}

function buildLookupKey(date: string, homeTeam: TeamAbbr, awayTeam: TeamAbbr) {
  return `${date.replaceAll('-', '')}${homeTeam}${awayTeam}`
}

async function setOddsOverrideStatus(args: {
  date?: string
  source?: string
  lookupKeys?: string[]
  status: 'approved' | 'rejected'
}) {
  const date = assertDateInput(args.date)
  const lookupKeys = (args.lookupKeys ?? []).map((value) => value.trim()).filter(Boolean)
  const result = await updateOddsOverrideStatus({
    date,
    source: args.source,
    lookupKeys,
    status: args.status,
  })

  return {
    date,
    source: args.source ?? null,
    status: args.status,
    updatedCount: result.count,
    lookupKeys,
  }
}
