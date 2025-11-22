-- CreateTable
CREATE TABLE "Sensor" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "honeypot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sensor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_uuid_key" ON "Sensor"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_identifier_key" ON "Sensor"("identifier");

-- CreateIndex
CREATE INDEX "Sensor_uuid_idx" ON "Sensor"("uuid");

-- CreateIndex
CREATE INDEX "Sensor_identifier_idx" ON "Sensor"("identifier");

-- CreateIndex
CREATE INDEX "Sensor_honeypot_idx" ON "Sensor"("honeypot");
