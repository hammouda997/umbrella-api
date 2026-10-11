-- CreateEnum
CREATE TYPE "PickupManifestKind" AS ENUM ('EN_ATTENTE', 'PRE_ENLEVEMENT');

-- CreateEnum
CREATE TYPE "PickupManifestStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "PickupManifest" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "PickupManifestKind" NOT NULL,
    "status" "PickupManifestStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" INTEGER NOT NULL,
    "senderId" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickupManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickupManifestItem" (
    "id" SERIAL NOT NULL,
    "manifestId" INTEGER NOT NULL,
    "parcelId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PickupManifestItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PickupManifest_code_key" ON "PickupManifest"("code");

-- CreateIndex
CREATE INDEX "PickupManifest_kind_idx" ON "PickupManifest"("kind");

-- CreateIndex
CREATE INDEX "PickupManifest_status_idx" ON "PickupManifest"("status");

-- CreateIndex
CREATE INDEX "PickupManifest_createdById_idx" ON "PickupManifest"("createdById");

-- CreateIndex
CREATE INDEX "PickupManifest_senderId_idx" ON "PickupManifest"("senderId");

-- CreateIndex
CREATE INDEX "PickupManifest_code_idx" ON "PickupManifest"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PickupManifestItem_parcelId_key" ON "PickupManifestItem"("parcelId");

-- CreateIndex
CREATE INDEX "PickupManifestItem_manifestId_idx" ON "PickupManifestItem"("manifestId");

-- AddForeignKey
ALTER TABLE "PickupManifest" ADD CONSTRAINT "PickupManifest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupManifest" ADD CONSTRAINT "PickupManifest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupManifestItem" ADD CONSTRAINT "PickupManifestItem_manifestId_fkey" FOREIGN KEY ("manifestId") REFERENCES "PickupManifest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickupManifestItem" ADD CONSTRAINT "PickupManifestItem_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
