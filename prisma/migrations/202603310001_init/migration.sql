CREATE TABLE "TeamStatSnapshot" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "sourceSeason" INTEGER NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamStatSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SlateGame" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "awayTeam" TEXT NOT NULL,
  "homeTeam" TEXT NOT NULL,
  "gameTime" TEXT,
  "gameDateIso" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'loaded',
  "context" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SlateGame_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketOddsSnapshot" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "odds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketOddsSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharpSignalRaw" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SharpSignalRaw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharpSignalNormalized" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "steamLean" TEXT NOT NULL,
  "reverseLean" TEXT NOT NULL,
  "openingHomeMoneyline" INTEGER,
  "openingAwayMoneyline" INTEGER,
  "openingTotal" DOUBLE PRECISION,
  "moneylineHomeBetsPct" DOUBLE PRECISION,
  "moneylineHomeMoneyPct" DOUBLE PRECISION,
  "totalOverBetsPct" DOUBLE PRECISION,
  "totalOverMoneyPct" DOUBLE PRECISION,
  "snapshot" JSONB NOT NULL,
  "lastUpdated" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SharpSignalNormalized_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PredictionRun" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'pending_review',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "exportPath" TEXT,
  "resultsPath" TEXT,
  "summary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PredictionRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Prediction" (
  "id" TEXT NOT NULL,
  "predictionRunId" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "awayTeam" TEXT NOT NULL,
  "homeTeam" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameResult" (
  "id" TEXT NOT NULL,
  "businessDate" TIMESTAMP(3) NOT NULL,
  "lookupKey" TEXT NOT NULL,
  "awayTeam" TEXT NOT NULL,
  "homeTeam" TEXT NOT NULL,
  "awayScore" INTEGER NOT NULL,
  "homeScore" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EvaluationSummary" (
  "id" TEXT NOT NULL,
  "fromDate" TIMESTAMP(3) NOT NULL,
  "toDate" TIMESTAMP(3) NOT NULL,
  "modelVersion" TEXT,
  "thresholds" JSONB NOT NULL,
  "summary" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationSummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelVersion" (
  "id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "description" TEXT,
  "parameters" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalibrationRun" (
  "id" TEXT NOT NULL,
  "modelVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "output" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CalibrationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamStatSnapshot_businessDate_sourceSeason_key" ON "TeamStatSnapshot"("businessDate", "sourceSeason");
CREATE UNIQUE INDEX "SlateGame_businessDate_lookupKey_key" ON "SlateGame"("businessDate", "lookupKey");
CREATE UNIQUE INDEX "MarketOddsSnapshot_businessDate_lookupKey_source_key" ON "MarketOddsSnapshot"("businessDate", "lookupKey", "source");
CREATE UNIQUE INDEX "SharpSignalRaw_businessDate_lookupKey_provider_key" ON "SharpSignalRaw"("businessDate", "lookupKey", "provider");
CREATE UNIQUE INDEX "SharpSignalNormalized_businessDate_lookupKey_provider_key" ON "SharpSignalNormalized"("businessDate", "lookupKey", "provider");
CREATE INDEX "PredictionRun_businessDate_createdAt_idx" ON "PredictionRun"("businessDate", "createdAt" DESC);
CREATE UNIQUE INDEX "Prediction_predictionRunId_lookupKey_key" ON "Prediction"("predictionRunId", "lookupKey");
CREATE INDEX "Prediction_businessDate_lookupKey_idx" ON "Prediction"("businessDate", "lookupKey");
CREATE UNIQUE INDEX "GameResult_businessDate_lookupKey_key" ON "GameResult"("businessDate", "lookupKey");
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_predictionRunId_fkey" FOREIGN KEY ("predictionRunId") REFERENCES "PredictionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
