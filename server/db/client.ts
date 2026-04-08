import { PrismaClient } from '@prisma/client'

import { appConfig, isDbConfigured } from '../config.js'

declare global {
  // eslint-disable-next-line no-var
  var __mlbPrisma__: PrismaClient | undefined
}

export function getPrismaClient() {
  if (!isDbConfigured()) return null

  if (!globalThis.__mlbPrisma__) {
    globalThis.__mlbPrisma__ = new PrismaClient({
      datasources: {
        db: {
          url: appConfig.databaseUrl ?? undefined,
        },
      },
    })
  }

  return globalThis.__mlbPrisma__
}
