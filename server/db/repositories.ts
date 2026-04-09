import { Prisma } from '@prisma/client'

import type { GradingResultRow, TeamRatingsSnapshot } from '../../src/lib/mlbApi.js'
import type { OddsInput, ScheduleRow, SharpSignalInput, TeamAbbr } from '../../src/lib/mlbTypes.js'
import { getPrismaClient } from './client.js'
import type { AutomationPredictionRow } from '../services/mlbAutomation.js'

function toBusinessDate(date: string) {
  return new Date(`${date}T00:00:00.000Z`)
}

function toJson(value: unknown) {
  return value as Prisma.InputJsonValue
}

export async function saveTeamStatSnapshot(date: string, snapshot: TeamRatingsSnapshot) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.teamStatSnapshot.upsert({
    where: {
      businessDate_sourceSeason: {
        businessDate: toBusinessDate(date),
        sourceSeason: snapshot.sourceSeason,
      },
    },
    update: {
      fetchedAt: new Date(snapshot.fetchedAt),
      payload: toJson(snapshot.teams),
    },
    create: {
      businessDate: toBusinessDate(date),
      sourceSeason: snapshot.sourceSeason,
      fetchedAt: new Date(snapshot.fetchedAt),
      payload: toJson(snapshot.teams),
    },
  })
}

export async function saveSlateRows(date: string, rows: ScheduleRow[]) {
  const prisma = getPrismaClient()
  if (!prisma) return 0

  await Promise.all(
    rows.map((row) => {
      const lookupKey = `${date.replaceAll('-', '')}${row.game.homeTeam}${row.game.awayTeam}`
      return prisma.slateGame.upsert({
        where: {
          businessDate_lookupKey: {
            businessDate: toBusinessDate(date),
            lookupKey,
          },
        },
        update: {
          awayTeam: row.game.awayTeam,
          homeTeam: row.game.homeTeam,
          gameTime: row.game.gameTime,
          gameDateIso: row.game.gameDateIso ? new Date(row.game.gameDateIso) : null,
          status: row.result ? 'predicted' : 'loaded',
          context: toJson(row),
        },
        create: {
          businessDate: toBusinessDate(date),
          lookupKey,
          awayTeam: row.game.awayTeam,
          homeTeam: row.game.homeTeam,
          gameTime: row.game.gameTime,
          gameDateIso: row.game.gameDateIso ? new Date(row.game.gameDateIso) : null,
          status: row.result ? 'predicted' : 'loaded',
          context: toJson(row),
        },
      })
    }),
  )

  return rows.length
}

function saveNormalizedSharp(prisma: NonNullable<ReturnType<typeof getPrismaClient>>, date: string, lookupKey: string, input: SharpSignalInput) {
  return prisma.sharpSignalNormalized.upsert({
    where: {
      businessDate_lookupKey_provider: {
        businessDate: toBusinessDate(date),
        lookupKey,
        provider: input.source,
      },
    },
    update: {
      source: input.source,
      steamLean: input.steamLean,
      reverseLean: input.reverseLean,
      openingHomeMoneyline: input.openingHomeMoneyline,
      openingAwayMoneyline: input.openingAwayMoneyline,
      openingTotal: input.openingTotal,
      moneylineHomeBetsPct: input.moneylineHomeBetsPct,
      moneylineHomeMoneyPct: input.moneylineHomeMoneyPct,
      totalOverBetsPct: input.totalOverBetsPct,
      totalOverMoneyPct: input.totalOverMoneyPct,
      snapshot: toJson(input),
      lastUpdated: new Date(input.lastUpdated),
    },
    create: {
      businessDate: toBusinessDate(date),
      lookupKey,
      provider: input.source,
      source: input.source,
      steamLean: input.steamLean,
      reverseLean: input.reverseLean,
      openingHomeMoneyline: input.openingHomeMoneyline,
      openingAwayMoneyline: input.openingAwayMoneyline,
      openingTotal: input.openingTotal,
      moneylineHomeBetsPct: input.moneylineHomeBetsPct,
      moneylineHomeMoneyPct: input.moneylineHomeMoneyPct,
      totalOverBetsPct: input.totalOverBetsPct,
      totalOverMoneyPct: input.totalOverMoneyPct,
      snapshot: toJson(input),
      lastUpdated: new Date(input.lastUpdated),
    },
  })
}

export async function saveOddsAndSharp(date: string, rows: ScheduleRow[]) {
  const prisma = getPrismaClient()
  if (!prisma) return 0

  await Promise.all(
    rows.flatMap((row) => {
      const lookupKey = `${date.replaceAll('-', '')}${row.game.homeTeam}${row.game.awayTeam}`
      const writes: Promise<unknown>[] = [
        prisma.marketOddsSnapshot.upsert({
          where: {
            businessDate_lookupKey_source: {
              businessDate: toBusinessDate(date),
              lookupKey,
              source: row.odds.source,
            },
          },
          update: {
            odds: toJson(row.odds),
          },
          create: {
            businessDate: toBusinessDate(date),
            lookupKey,
            source: row.odds.source,
            odds: toJson(row.odds),
          },
        }),
      ]

      if (row.sharpInput) {
        writes.push(
          prisma.sharpSignalRaw.upsert({
            where: {
              businessDate_lookupKey_provider: {
                businessDate: toBusinessDate(date),
                lookupKey,
                provider: row.sharpInput.source,
              },
            },
            update: {
              payload: toJson(row.sharpInput),
              fetchedAt: new Date(row.sharpInput.lastUpdated),
            },
            create: {
              businessDate: toBusinessDate(date),
              lookupKey,
              provider: row.sharpInput.source,
              payload: toJson(row.sharpInput),
              fetchedAt: new Date(row.sharpInput.lastUpdated),
            },
          }),
        )
        writes.push(saveNormalizedSharp(prisma, date, lookupKey, row.sharpInput))
      }

      return writes
    }),
  )

  return rows.length
}

export async function saveOddsOverrides(
  date: string,
  rows: Array<{
    lookupKey: string
    awayTeam: TeamAbbr
    homeTeam: TeamAbbr
    source: string
    status?: string
    odds: OddsInput
    metadata?: Record<string, unknown> | null
  }>,
) {
  const prisma = getPrismaClient()
  if (!prisma) return 0

  await Promise.all(
    rows.map((row) =>
      prisma.oddsOverride.upsert({
        where: {
          businessDate_lookupKey_source: {
            businessDate: toBusinessDate(date),
            lookupKey: row.lookupKey,
            source: row.source,
          },
        },
        update: {
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          status: row.status ?? 'staged',
          odds: toJson(row.odds),
          metadata: row.metadata ? toJson(row.metadata) : Prisma.JsonNull,
        },
        create: {
          businessDate: toBusinessDate(date),
          lookupKey: row.lookupKey,
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          source: row.source,
          status: row.status ?? 'staged',
          odds: toJson(row.odds),
          metadata: row.metadata ? toJson(row.metadata) : undefined,
        },
      }),
    ),
  )

  return rows.length
}

export async function listOddsOverridesByDate(date: string) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.oddsOverride.findMany({
    where: {
      businessDate: toBusinessDate(date),
    },
    orderBy: [{ updatedAt: 'desc' }, { lookupKey: 'asc' }],
  })
}

export async function getOddsOverridesForDate(
  date: string,
  args?: {
    source?: string
    statuses?: string[]
  },
) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.oddsOverride.findMany({
    where: {
      businessDate: toBusinessDate(date),
      source: args?.source,
      status: args?.statuses?.length ? { in: args.statuses } : undefined,
    },
    orderBy: [{ updatedAt: 'desc' }, { lookupKey: 'asc' }],
  })
}

export async function updateOddsOverrideStatus(args: {
  date: string
  status: string
  source?: string
  lookupKeys?: string[]
}) {
  const prisma = getPrismaClient()
  if (!prisma) return { count: 0 }

  return prisma.oddsOverride.updateMany({
    where: {
      businessDate: toBusinessDate(args.date),
      source: args.source,
      lookupKey: args.lookupKeys?.length ? { in: args.lookupKeys } : undefined,
    },
    data: {
      status: args.status,
    },
  })
}

export async function createPredictionRun(date: string, modelVersion: string, summary: Record<string, unknown>) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.predictionRun.create({
    data: {
      businessDate: toBusinessDate(date),
      modelVersion,
      summary: toJson(summary),
    },
  })
}

export async function findOrCreatePredictionRun(date: string, modelVersion: string, summary: Record<string, unknown>) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  const existing = await prisma.predictionRun.findFirst({
    where: {
      businessDate: toBusinessDate(date),
      modelVersion,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (existing) {
    return prisma.predictionRun.update({
      where: { id: existing.id },
      data: {
        summary: toJson(summary),
      },
    })
  }

  return createPredictionRun(date, modelVersion, summary)
}

export async function savePredictions(runId: string | null, date: string, rows: AutomationPredictionRow[]) {
  const prisma = getPrismaClient()
  if (!prisma || !runId) return 0

  await Promise.all(
    rows.map((row) =>
      prisma.prediction.upsert({
        where: {
          predictionRunId_lookupKey: {
            predictionRunId: runId,
            lookupKey: row.lookupKey,
          },
        },
        update: {
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          payload: toJson(row),
        },
        create: {
          predictionRunId: runId,
          businessDate: toBusinessDate(date),
          lookupKey: row.lookupKey,
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          payload: toJson(row),
        },
      }),
    ),
  )

  return rows.length
}

export async function updatePredictionRunExports(runId: string | null, data: { exportPath?: string; resultsPath?: string; reviewStatus?: string }) {
  const prisma = getPrismaClient()
  if (!prisma || !runId) return null

  return prisma.predictionRun.update({
    where: { id: runId },
    data,
  })
}

export async function saveResults(date: string, rows: GradingResultRow[]) {
  const prisma = getPrismaClient()
  if (!prisma) return 0

  await Promise.all(
    rows.map((row) =>
      prisma.gameResult.upsert({
        where: {
          businessDate_lookupKey: {
            businessDate: toBusinessDate(date),
            lookupKey: row.lookupKey,
          },
        },
        update: {
          awayTeam: row.away,
          homeTeam: row.home,
          awayScore: row.awayScore,
          homeScore: row.homeScore,
          payload: toJson(row),
        },
        create: {
          businessDate: toBusinessDate(date),
          lookupKey: row.lookupKey,
          awayTeam: row.away,
          homeTeam: row.home,
          awayScore: row.awayScore,
          homeScore: row.homeScore,
          payload: toJson(row),
        },
      }),
    ),
  )

  return rows.length
}

export async function listPredictionRuns(limit = 10) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.predictionRun.findMany({
    orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
}

export async function getPredictionsByRunOrDate(args: { runId?: string; date?: string }) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  if (args.runId) {
    return prisma.prediction.findMany({
      where: { predictionRunId: args.runId },
      orderBy: { lookupKey: 'asc' },
    })
  }

  if (args.date) {
    return prisma.prediction.findMany({
      where: { businessDate: toBusinessDate(args.date) },
      orderBy: { lookupKey: 'asc' },
    })
  }

  return []
}

export async function getPredictionsByDateRange(fromDate: string, toDate: string) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.prediction.findMany({
    where: {
      businessDate: {
        gte: toBusinessDate(fromDate),
        lte: toBusinessDate(toDate),
      },
    },
    orderBy: [{ businessDate: 'desc' }, { lookupKey: 'asc' }],
  })
}

export async function getResultsByDateRange(fromDate: string, toDate: string) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.gameResult.findMany({
    where: {
      businessDate: {
        gte: toBusinessDate(fromDate),
        lte: toBusinessDate(toDate),
      },
    },
    orderBy: [{ businessDate: 'desc' }, { lookupKey: 'asc' }],
  })
}

export async function saveEvaluationSummary(fromDate: string, toDate: string, thresholds: Record<string, unknown>, summary: Record<string, unknown>, modelVersion?: string) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.evaluationSummary.create({
    data: {
      fromDate: toBusinessDate(fromDate),
      toDate: toBusinessDate(toDate),
      modelVersion,
      thresholds: toJson(thresholds),
      summary: toJson(summary),
    },
  })
}
