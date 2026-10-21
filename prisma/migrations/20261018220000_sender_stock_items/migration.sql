-- CreateTable
CREATE TABLE "SenderStockItem" (
    "id" SERIAL NOT NULL,
    "senderId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SenderStockItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN "unitCost" DECIMAL(12,3);
ALTER TABLE "Parcel" ADD COLUMN "stockItemId" INTEGER;

-- CreateIndex
CREATE INDEX "SenderStockItem_senderId_idx" ON "SenderStockItem"("senderId");
CREATE INDEX "SenderStockItem_senderId_isActive_idx" ON "SenderStockItem"("senderId", "isActive");
CREATE INDEX "Parcel_stockItemId_idx" ON "Parcel"("stockItemId");

-- AddForeignKey
ALTER TABLE "SenderStockItem" ADD CONSTRAINT "SenderStockItem_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Parcel" ADD CONSTRAINT "Parcel_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "SenderStockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
