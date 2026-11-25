-- DropIndex
DROP INDEX "StoredFile_storeId_idx";

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "maxStorageMb" INTEGER DEFAULT 500;

-- AlterTable
ALTER TABLE "StoredFile" ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "StoredFile_storeId_createdAt_idx" ON "StoredFile"("storeId", "createdAt");

-- Backfill: more space on higher plans (editable in /platform/plans).
UPDATE "Plan" SET "maxStorageMb" = 5000 WHERE "position" = 2;
UPDATE "Plan" SET "maxStorageMb" = 20000 WHERE "position" >= 3;
