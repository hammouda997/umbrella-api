-- AlterEnum PaymentRequestStatus (values only — usage in a later migration)
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'VALIDE_FINANCE';
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'VALIDE_CHEF';
ALTER TYPE "PaymentRequestStatus" ADD VALUE IF NOT EXISTS 'VALIDE_EXPERT';

-- Agency expert batch window
ALTER TABLE "Agency" ADD COLUMN IF NOT EXISTS "expertBatchDeadlineAt" TIMESTAMP(3);

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "LivreurDepositStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable LivreurDeposit
CREATE TABLE IF NOT EXISTS "LivreurDeposit" (
    "id" SERIAL NOT NULL,
    "livreurId" INTEGER NOT NULL,
    "agencyId" INTEGER,
    "amount" DECIMAL(14,3) NOT NULL,
    "expectedAmount" DECIMAL(14,3) NOT NULL,
    "receiptUrl" TEXT NOT NULL,
    "status" "LivreurDepositStatus" NOT NULL DEFAULT 'PENDING',
    "runsheetParcelIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "rejectReason" TEXT,
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LivreurDeposit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LivreurDeposit_livreurId_status_idx" ON "LivreurDeposit"("livreurId", "status");
CREATE INDEX IF NOT EXISTS "LivreurDeposit_agencyId_status_idx" ON "LivreurDeposit"("agencyId", "status");
CREATE INDEX IF NOT EXISTS "LivreurDeposit_status_createdAt_idx" ON "LivreurDeposit"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "LivreurDeposit" ADD CONSTRAINT "LivreurDeposit_livreurId_fkey" FOREIGN KEY ("livreurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LivreurDeposit" ADD CONSTRAINT "LivreurDeposit_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "LivreurDeposit" ADD CONSTRAINT "LivreurDeposit_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CashMovement extras
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "depositId" INTEGER;

CREATE INDEX IF NOT EXISTS "CashMovement_depositId_idx" ON "CashMovement"("depositId");

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "LivreurDeposit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ReturnLot destination
ALTER TABLE "ReturnLot" ADD COLUMN IF NOT EXISTS "destinationLabel" TEXT;
ALTER TABLE "ReturnLot" ADD COLUMN IF NOT EXISTS "destinationAgencyId" INTEGER;
CREATE INDEX IF NOT EXISTS "ReturnLot_destinationAgencyId_idx" ON "ReturnLot"("destinationAgencyId");

DO $$ BEGIN
  ALTER TABLE "ReturnLot" ADD CONSTRAINT "ReturnLot_destinationAgencyId_fkey" FOREIGN KEY ("destinationAgencyId") REFERENCES "Agency"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- PickupManifest décharge + CIN
ALTER TABLE "PickupManifest" ADD COLUMN IF NOT EXISTS "dechargeUrl" TEXT;
ALTER TABLE "PickupManifest" ADD COLUMN IF NOT EXISTS "cinUrl" TEXT;
