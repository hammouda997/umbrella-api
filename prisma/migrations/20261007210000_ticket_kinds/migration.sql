-- CreateEnum
CREATE TYPE "TicketKind" AS ENUM ('GENERAL', 'CHANGEMENT_PRIX', 'RELANCE');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "kind" "TicketKind" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Ticket" ADD COLUMN "requestedPrice" DECIMAL(12,3);

-- CreateIndex
CREATE INDEX "Ticket_kind_idx" ON "Ticket"("kind");

-- CreateIndex
CREATE INDEX "Ticket_parcelId_idx" ON "Ticket"("parcelId");
