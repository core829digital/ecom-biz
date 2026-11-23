-- Account-level billing, plan limits, appearance, 2FA, sessions and audit log.
-- Order matters: new User columns → copy billing data from owned stores → drop Store columns.

-- 1. New columns
ALTER TABLE "Plan" ADD COLUMN "allowApi" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "allowCustomDomain" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "maxProducts" INTEGER,
ADD COLUMN "maxStaff" INTEGER,
ADD COLUMN "maxStores" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Session" ADD COLUMN "ip" TEXT,
ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "User" ADD COLUMN "accent" TEXT NOT NULL DEFAULT 'neutral',
ADD COLUMN "planId" TEXT,
ADD COLUMN "recoveryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "stripeCustomerId" TEXT,
ADD COLUMN "stripeSubscriptionId" TEXT,
ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN "totpSecret" TEXT,
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

-- 2. Carry each owner's subscription over from their oldest owned store.
UPDATE "User" u SET
  "planId" = s."planId",
  "subscriptionStatus" = s."subscriptionStatus",
  "trialEndsAt" = s."trialEndsAt",
  "stripeCustomerId" = s."stripeCustomerId",
  "stripeSubscriptionId" = s."stripeSubscriptionId"
FROM (
  SELECT DISTINCT ON (m."userId") m."userId", st."planId", st."subscriptionStatus", st."trialEndsAt", st."stripeCustomerId", st."stripeSubscriptionId"
  FROM "Membership" m JOIN "Store" st ON st."id" = m."storeId"
  WHERE m."role" = 'OWNER'
  ORDER BY m."userId", st."createdAt" ASC
) s
WHERE u."id" = s."userId";

-- 3. Everyone else gets the entry plan and a 14-day trial from sign-up.
UPDATE "User" SET "planId" = (SELECT "id" FROM "Plan" WHERE "active" ORDER BY "position" ASC LIMIT 1) WHERE "planId" IS NULL;
UPDATE "User" SET "trialEndsAt" = "createdAt" + INTERVAL '14 days' WHERE "trialEndsAt" IS NULL AND "subscriptionStatus" = 'TRIALING';

-- 4. Remove billing from stores.
ALTER TABLE "Store" DROP CONSTRAINT "Store_planId_fkey";
DROP INDEX "Store_stripeCustomerId_key";
DROP INDEX "Store_stripeSubscriptionId_key";
ALTER TABLE "Store" DROP COLUMN "planId",
DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
DROP COLUMN "subscriptionStatus",
DROP COLUMN "trialEndsAt";

-- 5. Audit log
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_storeId_createdAt_idx" ON "AuditLog"("storeId", "createdAt");
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- 6. Constraints
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
