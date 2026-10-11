-- CreateEnum
CREATE TYPE "ReturnLotStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "ReturnLot" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "senderId" INTEGER NOT NULL,
    "status" "ReturnLotStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLotItem" (
    "id" SERIAL NOT NULL,
    "lotId" INTEGER NOT NULL,
    "parcelId" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnLotItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnLot_code_key" ON "ReturnLot"("code");

-- CreateIndex
CREATE INDEX "ReturnLot_senderId_idx" ON "ReturnLot"("senderId");

-- CreateIndex
CREATE INDEX "ReturnLot_status_idx" ON "ReturnLot"("status");

-- CreateIndex
CREATE INDEX "ReturnLot_code_idx" ON "ReturnLot"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReturnLotItem_parcelId_key" ON "ReturnLotItem"("parcelId");

-- CreateIndex
CREATE INDEX "ReturnLotItem_lotId_idx" ON "ReturnLotItem"("lotId");

-- AddForeignKey
ALTER TABLE "ReturnLot" ADD CONSTRAINT "ReturnLot_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLotItem" ADD CONSTRAINT "ReturnLotItem_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "ReturnLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLotItem" ADD CONSTRAINT "ReturnLotItem_parcelId_fkey" FOREIGN KEY ("parcelId") REFERENCES "Parcel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
