-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "allowCustomCss" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "motionLevel" INTEGER NOT NULL DEFAULT 1;

-- Backfill: customers who already set a password did it through an emailed link, so they own the address.
UPDATE "Customer" SET "emailVerifiedAt" = "updatedAt" WHERE "passwordHash" IS NOT NULL;

-- Backfill: premium animations from the second plan up, custom CSS on the top plan (editable in /platform/plans).
UPDATE "Plan" SET "motionLevel" = 2 WHERE "position" >= 2;
UPDATE "Plan" SET "allowCustomCss" = true WHERE "position" = (SELECT MAX("position") FROM "Plan");
