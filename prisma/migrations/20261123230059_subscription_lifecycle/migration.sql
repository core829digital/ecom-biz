-- CreateEnum
CREATE TYPE "TrialClaimKind" AS ENUM ('EMAIL', 'CARD', 'NETWORK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingHoldReason" TEXT,
ADD COLUMN     "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "currentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "pastDueSince" TIMESTAMP(3),
ADD COLUMN     "trialUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailVerification" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialClaim" (
    "id" TEXT NOT NULL,
    "kind" "TrialClaimKind" NOT NULL,
    "valueHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerification_tokenHash_key" ON "EmailVerification"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerification_userId_idx" ON "EmailVerification"("userId");

-- CreateIndex
CREATE INDEX "TrialClaim_kind_valueHash_idx" ON "TrialClaim"("kind", "valueHash");

-- CreateIndex
CREATE INDEX "TrialClaim_kind_createdAt_idx" ON "TrialClaim"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "EmailVerification" ADD CONSTRAINT "EmailVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialClaim" ADD CONSTRAINT "TrialClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: accounts created before email verification existed are treated as verified,
-- and any account that already had a trial has used it (one trial per account, ever).
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "emailVerifiedAt" IS NULL;
UPDATE "User" SET "trialUsedAt" = "createdAt" WHERE "trialUsedAt" IS NULL AND ("trialEndsAt" IS NOT NULL OR "subscriptionStatus" = 'TRIALING');
