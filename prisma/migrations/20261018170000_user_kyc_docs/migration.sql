-- AlterTable
ALTER TABLE "User" ADD COLUMN "cinFrontUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "cinBackUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "selfieWithCinUrl" TEXT;
ALTER TABLE "User" ADD COLUMN "kycSubmittedAt" TIMESTAMP(3);
