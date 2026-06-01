-- CreateTable
CREATE TABLE "ResidualCorrection" (
    "id" TEXT NOT NULL,
    "businessDate" TIMESTAMP(3) NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "predictionRunId" TEXT,
    "deltaHome" DOUBLE PRECISION NOT NULL,
    "deltaAway" DOUBLE PRECISION NOT NULL,
    "correctedHome" DOUBLE PRECISION NOT NULL,
    "correctedAway" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidualCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResidualCorrection_businessDate_idx" ON "ResidualCorrection"("businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "ResidualCorrection_businessDate_lookupKey_key" ON "ResidualCorrection"("businessDate", "lookupKey");
