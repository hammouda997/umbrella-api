-- AlterEnum
ALTER TYPE "PaymentRequestStatus" ADD VALUE 'AWAITING_DECHARGE';

-- AlterTable Parcel
ALTER TABLE "Parcel" ADD COLUMN "deliveredAt" TIMESTAMP(3);

-- AlterTable PaymentRequest
ALTER TABLE "PaymentRequest" ADD COLUMN "dechargeUrl" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "dechargeUploadedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "Parcel_deliveredAt_idx" ON "Parcel"("deliveredAt");

INSERT INTO "PlatformSetting" ("key", "value", "updatedAt")
VALUES ('versementHoldHours', '48', CURRENT_TIMESTAMP);

UPDATE "Parcel" p
SET "deliveredAt" = e."createdAt"
FROM (
  SELECT DISTINCT ON ("parcelId") "parcelId", "createdAt"
  FROM "ParcelEvent"
  WHERE "status" = 'LIVRES'
  ORDER BY "parcelId", "createdAt" ASC
) e
WHERE p.id = e."parcelId"
  AND p."deliveredAt" IS NULL
  AND p."status" IN ('LIVRES', 'LIVRES_PAYES');

UPDATE "Parcel"
SET "deliveredAt" = "updatedAt"
WHERE "deliveredAt" IS NULL
  AND "status" IN ('LIVRES', 'LIVRES_PAYES');
