-- CreateTable
CREATE TABLE "Rule" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "classtype" TEXT NOT NULL,
    "sid" INTEGER NOT NULL,
    "rev" INTEGER NOT NULL,
    "ruleFormat" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "sourceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reference" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "ruleId" INTEGER NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSource" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_sid_idx" ON "Rule"("sid");

-- CreateIndex
CREATE INDEX "Rule_isActive_idx" ON "Rule"("isActive");

-- CreateIndex
CREATE INDEX "Rule_classtype_idx" ON "Rule"("classtype");

-- CreateIndex
CREATE UNIQUE INDEX "Rule_sid_rev_key" ON "Rule"("sid", "rev");

-- CreateIndex
CREATE INDEX "Reference_ruleId_idx" ON "Reference"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSource_name_key" ON "RuleSource"("name");

-- CreateIndex
CREATE INDEX "RuleSource_name_idx" ON "RuleSource"("name");

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "RuleSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
