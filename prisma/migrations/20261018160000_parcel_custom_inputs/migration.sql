-- AlterTable
ALTER TABLE "User" ADD COLUMN "parcelInputDefs" JSONB;

-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN "customInputs" JSONB;
