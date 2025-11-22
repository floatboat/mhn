-- CreateTable
CREATE TABLE "HPFeedsCredential" (
    "id" SERIAL NOT NULL,
    "sensorId" INTEGER NOT NULL,
    "uuid" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HPFeedsCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HPFeedsCredential_sensorId_key" ON "HPFeedsCredential"("sensorId");

-- CreateIndex
CREATE UNIQUE INDEX "HPFeedsCredential_uuid_key" ON "HPFeedsCredential"("uuid");

-- CreateIndex
CREATE INDEX "HPFeedsCredential_uuid_idx" ON "HPFeedsCredential"("uuid");

-- CreateIndex
CREATE INDEX "HPFeedsCredential_channel_idx" ON "HPFeedsCredential"("channel");

-- AddForeignKey
ALTER TABLE "HPFeedsCredential" ADD CONSTRAINT "HPFeedsCredential_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "Sensor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
