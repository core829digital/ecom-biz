-- AlterTable
ALTER TABLE "Checkout" ADD COLUMN     "acceptsMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "note" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paymentInstructions" TEXT,
ADD COLUMN     "statusToken" TEXT NOT NULL,
ADD COLUMN     "taxRateBps" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Order_statusToken_key" ON "Order"("statusToken");
