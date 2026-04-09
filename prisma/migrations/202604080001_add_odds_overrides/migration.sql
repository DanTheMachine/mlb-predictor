-- CreateTable
CREATE TABLE "OddsOverride" (
    "id" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'staged',
    "odds" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OddsOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OddsOverride_businessDate_lookupKey_source_key" ON "OddsOverride"("businessDate", "lookupKey", "source");

-- CreateIndex
CREATE INDEX "OddsOverride_businessDate_status_idx" ON "OddsOverride"("businessDate", "status");
