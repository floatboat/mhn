-- CreateTable
CREATE TABLE "Attack" (
    "id" SERIAL NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "port" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sensorId" INTEGER NOT NULL,
    "mongoId" TEXT,
    "country" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Attack_sourceIp_idx" ON "Attack"("sourceIp");

-- CreateIndex
CREATE INDEX "Attack_timestamp_idx" ON "Attack"("timestamp");

-- CreateIndex
CREATE INDEX "Attack_sensorId_idx" ON "Attack"("sensorId");

-- CreateIndex
CREATE INDEX "Attack_mongoId_idx" ON "Attack"("mongoId");

-- AddForeignKey
ALTER TABLE "Attack" ADD CONSTRAINT "Attack_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
