-- AlterEnum: EXPERT_COMPTABLE
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'EXPERT_COMPTABLE';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CashRegisterKind" AS ENUM ('DEPENSE', 'COD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CashMovementType" AS ENUM ('IN', 'OUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CashRegister" (
    "id" SERIAL NOT NULL,
    "kind" "CashRegisterKind" NOT NULL,
    "name" TEXT NOT NULL,
    "agencyId" INTEGER,
    "balance" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CashMovement" (
    "id" SERIAL NOT NULL,
    "registerId" INTEGER NOT NULL,
    "type" "CashMovementType" NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "label" TEXT NOT NULL,
    "note" TEXT,
    "actorId" INTEGER,
    "parcelId" INTEGER,
    "livreurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashRegister_kind_agencyId_key" ON "CashRegister"("kind", "agencyId");
CREATE UNIQUE INDEX IF NOT EXISTS "CashRegister_cod_global_uidx"
  ON "CashRegister" ("kind") WHERE "kind" = 'COD' AND "agencyId" IS NULL;
CREATE INDEX IF NOT EXISTS "CashRegister_kind_idx" ON "CashRegister"("kind");
CREATE INDEX IF NOT EXISTS "CashRegister_agencyId_idx" ON "CashRegister"("agencyId");
CREATE INDEX IF NOT EXISTS "CashMovement_registerId_createdAt_idx" ON "CashMovement"("registerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CashMovement_actorId_idx" ON "CashMovement"("actorId");
CREATE INDEX IF NOT EXISTS "CashMovement_livreurId_idx" ON "CashMovement"("livreurId");

DO $$ BEGIN
  ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_agencyId_fkey"
    FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registerId_fkey"
    FOREIGN KEY ("registerId") REFERENCES "CashRegister"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
