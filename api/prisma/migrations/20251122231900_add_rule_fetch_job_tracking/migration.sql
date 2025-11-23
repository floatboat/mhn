-- CreateTable
CREATE TABLE "RuleFetchJob" (
    "id" SERIAL NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "rulesImported" INTEGER NOT NULL DEFAULT 0,
    "rulesFailed" INTEGER NOT NULL DEFAULT 0,
    "rulesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleFetchJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RuleFetchJob_sourceId_idx" ON "RuleFetchJob"("sourceId");

-- CreateIndex
CREATE INDEX "RuleFetchJob_status_idx" ON "RuleFetchJob"("status");

-- CreateIndex
CREATE INDEX "RuleFetchJob_lastAttempt_idx" ON "RuleFetchJob"("lastAttempt");

-- AddForeignKey
ALTER TABLE "RuleFetchJob" ADD CONSTRAINT "RuleFetchJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
