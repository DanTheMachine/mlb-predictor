DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Sport') THEN
    CREATE TYPE "Sport" AS ENUM ('MLB', 'NBA', 'NHL', 'NCAAM', 'NFL', 'NCAAF');
  END IF;
END $$;

ALTER TABLE "PredictionRun"
ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'MLB';

ALTER TABLE "EvaluationSummary"
ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'MLB';

ALTER TABLE "ModelVersion"
ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'MLB';

DROP INDEX IF EXISTS "ModelVersion_version_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ModelVersion_sport_version_key"
ON "ModelVersion"("sport", "version");

ALTER TABLE "CalibrationRun"
ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'MLB';

ALTER TABLE "OddsOverride"
ADD COLUMN IF NOT EXISTS "sport" "Sport" NOT NULL DEFAULT 'MLB';

DROP INDEX IF EXISTS "PredictionRun_businessDate_createdAt_idx";
CREATE INDEX IF NOT EXISTS "PredictionRun_sport_businessDate_createdAt_idx"
ON "PredictionRun"("sport", "businessDate", "createdAt" DESC);

DROP INDEX IF EXISTS "OddsOverride_businessDate_lookupKey_source_key";
CREATE UNIQUE INDEX IF NOT EXISTS "OddsOverride_sport_businessDate_lookupKey_source_key"
ON "OddsOverride"("sport", "businessDate", "lookupKey", "source");

DROP INDEX IF EXISTS "OddsOverride_businessDate_status_idx";
CREATE INDEX IF NOT EXISTS "OddsOverride_sport_businessDate_status_idx"
ON "OddsOverride"("sport", "businessDate", "status");

CREATE TABLE IF NOT EXISTS "PredictionFile" (
  "id" TEXT NOT NULL,
  "sport" "Sport" NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "fileRole" TEXT NOT NULL DEFAULT 'export',
  "metadata" JSONB,
  "predictionRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PredictionFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ResultFile" (
  "id" TEXT NOT NULL,
  "sport" "Sport" NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "fileRole" TEXT NOT NULL DEFAULT 'export',
  "metadata" JSONB,
  "predictionRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ResultFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PredictionFile_sport_businessDate_createdAt_idx"
ON "PredictionFile"("sport", "businessDate", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ResultFile_sport_businessDate_createdAt_idx"
ON "ResultFile"("sport", "businessDate", "createdAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PredictionFile_predictionRunId_fkey'
      AND table_name = 'PredictionFile'
  ) THEN
    ALTER TABLE "PredictionFile"
    ADD CONSTRAINT "PredictionFile_predictionRunId_fkey"
    FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ResultFile_predictionRunId_fkey'
      AND table_name = 'ResultFile'
  ) THEN
    ALTER TABLE "ResultFile"
    ADD CONSTRAINT "ResultFile_predictionRunId_fkey"
    FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
