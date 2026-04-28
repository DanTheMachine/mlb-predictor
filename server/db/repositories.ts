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

const DEFAULT_SPORT = 'MLB' as const

export async function saveTeamStatSnapshot(date: string, snapshot: TeamRatingsSnapshot) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.mlbTeamStatSnapshot.upsert({
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

  const seenCounts = new Map<string, number>()
  await Promise.all(
    rows.map((row) => {
      const baseKey = `${date.replaceAll('-', '')}${row.game.homeTeam}${row.game.awayTeam}`
      const count = (seenCounts.get(baseKey) ?? 0) + 1
      seenCounts.set(baseKey, count)
      const lookupKey = count === 1 ? baseKey : `${baseKey}_${count}`
      return prisma.mlbSlateGame.upsert({
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
  return prisma.mlbSharpSignalNormalized.upsert({
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

  const seenCounts = new Map<string, number>()
  await Promise.all(
    rows.flatMap((row) => {
      const baseKey = `${date.replaceAll('-', '')}${row.game.homeTeam}${row.game.awayTeam}`
      const count = (seenCounts.get(baseKey) ?? 0) + 1
      seenCounts.set(baseKey, count)
      const lookupKey = count === 1 ? baseKey : `${baseKey}_${count}`
      const writes: Promise<unknown>[] = [
        prisma.mlbMarketOddsSnapshot.upsert({
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
          prisma.mlbSharpSignalRaw.upsert({
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
    awayStarter?: string | null
    homeStarter?: string | null
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
      prisma.mlbOddsOverride.upsert({
        where: {
          sport_businessDate_lookupKey_source: {
            sport: DEFAULT_SPORT,
            businessDate: toBusinessDate(date),
            lookupKey: row.lookupKey,
            source: row.source,
          },
        },
        update: {
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          awayStarter: row.awayStarter ?? null,
          homeStarter: row.homeStarter ?? null,
          status: row.status ?? 'staged',
          odds: toJson(row.odds),
          metadata: row.metadata ? toJson(row.metadata) : Prisma.JsonNull,
        },
        create: {
          sport: DEFAULT_SPORT,
          businessDate: toBusinessDate(date),
          lookupKey: row.lookupKey,
          awayTeam: row.awayTeam,
          homeTeam: row.homeTeam,
          awayStarter: row.awayStarter ?? null,
          homeStarter: row.homeStarter ?? null,
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

  return prisma.mlbOddsOverride.findMany({
    where: {
      sport: DEFAULT_SPORT,
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

  return prisma.mlbOddsOverride.findMany({
    where: {
      sport: DEFAULT_SPORT,
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

  return prisma.mlbOddsOverride.updateMany({
    where: {
      sport: DEFAULT_SPORT,
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
      sport: DEFAULT_SPORT,
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
      sport: DEFAULT_SPORT,
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
      prisma.mlbPrediction.upsert({
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
      prisma.mlbGameResult.upsert({
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
    where: {
      sport: DEFAULT_SPORT,
    },
    orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })
}

export async function getLatestPredictionRunForDate(date: string) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.predictionRun.findFirst({
    where: {
      businessDate: toBusinessDate(date),
      sport: DEFAULT_SPORT,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getPredictionsByRunOrDate(args: { runId?: string; date?: string }) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  if (args.runId) {
    return prisma.mlbPrediction.findMany({
      where: { predictionRunId: args.runId },
      orderBy: { lookupKey: 'asc' },
    })
  }

  if (args.date) {
    // Scope to the most recent run for this date to avoid duplicate rows
    // when the pipeline has been run multiple times on the same date.
    const latestRun = await getLatestPredictionRunForDate(args.date)
    if (latestRun) {
      return prisma.mlbPrediction.findMany({
        where: { predictionRunId: latestRun.id },
        orderBy: { lookupKey: 'asc' },
      })
    }
    // Fallback: no run record found, query by date directly
    return prisma.mlbPrediction.findMany({
      where: { businessDate: toBusinessDate(args.date) },
      orderBy: { lookupKey: 'asc' },
    })
  }

  return []
}

export async function getPredictionsByDateRange(fromDate: string, toDate: string) {
  const prisma = getPrismaClient()
  if (!prisma) return []

  return prisma.mlbPrediction.findMany({
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

  return prisma.mlbGameResult.findMany({
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
      sport: DEFAULT_SPORT,
      fromDate: toBusinessDate(fromDate),
      toDate: toBusinessDate(toDate),
      modelVersion,
      thresholds: toJson(thresholds),
      summary: toJson(summary),
    },
  })
}

export async function createPredictionFileRecord(args: {
  date: string
  path: string
  source: string
  fileRole?: string
  runId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.predictionFile.create({
    data: {
      sport: DEFAULT_SPORT,
      businessDate: toBusinessDate(args.date),
      source: args.source,
      path: args.path,
      fileRole: args.fileRole ?? 'export',
      predictionRunId: args.runId ?? undefined,
      metadata: args.metadata ? toJson(args.metadata) : undefined,
    },
  })
}

export async function createResultFileRecord(args: {
  date: string
  path: string
  source: string
  fileRole?: string
  runId?: string | null
  metadata?: Record<string, unknown> | null
}) {
  const prisma = getPrismaClient()
  if (!prisma) return null

  return prisma.resultFile.create({
    data: {
      sport: DEFAULT_SPORT,
      businessDate: toBusinessDate(args.date),
      source: args.source,
      path: args.path,
      fileRole: args.fileRole ?? 'export',
      predictionRunId: args.runId ?? undefined,
      metadata: args.metadata ? toJson(args.metadata) : undefined,
    },
  })
}
