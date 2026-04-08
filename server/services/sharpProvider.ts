import type { ScheduleRow, SharpSignalInput } from '../../src/lib/mlbTypes.js'

export type SharpProviderResult = {
  lookupKey: string
  raw: Record<string, unknown>
  normalized: SharpSignalInput
}

export type SharpProvider = {
  name: string
  // eslint-disable-next-line no-unused-vars
  load(date: string, rows: ScheduleRow[]): Promise<SharpProviderResult[]>
}

function lookupKeyForRow(row: ScheduleRow, date: string) {
  return `${date.replaceAll('-', '')}${row.game.homeTeam}${row.game.awayTeam}`
}

export const espnDerivedSharpProvider: SharpProvider = {
  name: 'espn-derived',
  async load(date, rows) {
    return rows.map((row) => {
      const normalized =
        row.sharpInput ??
        ({
          source: 'espn-derived',
          lastUpdated: new Date().toISOString(),
          openingHomeMoneyline: row.odds.homeMoneyline,
          openingAwayMoneyline: row.odds.awayMoneyline,
          openingTotal: row.odds.overUnder,
          moneylineHomeBetsPct: null,
          moneylineHomeMoneyPct: null,
          totalOverBetsPct: null,
          totalOverMoneyPct: null,
          steamLean: 'none',
          reverseLean: 'none',
        } satisfies SharpSignalInput)

      return {
        lookupKey: lookupKeyForRow(row, date),
        raw: {
          source: normalized.source,
          openingHomeMoneyline: normalized.openingHomeMoneyline,
          openingAwayMoneyline: normalized.openingAwayMoneyline,
          openingTotal: normalized.openingTotal,
          steamLean: normalized.steamLean,
          reverseLean: normalized.reverseLean,
        },
        normalized,
      }
    })
  },
}

export function resolveSharpProvider(name: string): SharpProvider {
  if (name === espnDerivedSharpProvider.name) {
    return espnDerivedSharpProvider
  }

  return espnDerivedSharpProvider
}
