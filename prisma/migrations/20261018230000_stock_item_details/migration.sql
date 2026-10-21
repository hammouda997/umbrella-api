-- AlterTable
ALTER TABLE "SenderStockItem" ADD COLUMN "size" TEXT;
ALTER TABLE "SenderStockItem" ADD COLUMN "sku" TEXT;
ALTER TABLE "SenderStockItem" ADD COLUMN "defaultSalePrice" DECIMAL(12,3);
ALTER TABLE "SenderStockItem" ADD COLUMN "lowStockAt" INTEGER;
