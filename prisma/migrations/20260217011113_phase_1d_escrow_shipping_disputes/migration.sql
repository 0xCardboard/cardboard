/*
  Warnings:

  - The values [AUTHORIZED] on the enum `EscrowStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_REFUND', 'RESOLVED_REPLACEMENT', 'RESOLVED_REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DisputeReason" AS ENUM ('SHIPPING_DAMAGE', 'WRONG_CARD', 'GRADE_DISCREPANCY', 'NON_DELIVERY', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "EscrowStatus_new" AS ENUM ('PENDING', 'PAYMENT_FAILED', 'CAPTURED', 'RELEASED', 'REFUNDED', 'CANCELLED');
ALTER TABLE "public"."Trade" ALTER COLUMN "escrowStatus" DROP DEFAULT;
ALTER TABLE "Trade" ALTER COLUMN "escrowStatus" TYPE "EscrowStatus_new" USING ("escrowStatus"::text::"EscrowStatus_new");
ALTER TYPE "EscrowStatus" RENAME TO "EscrowStatus_old";
ALTER TYPE "EscrowStatus_new" RENAME TO "EscrowStatus";
DROP TYPE "public"."EscrowStatus_old";
ALTER TABLE "Trade" ALTER COLUMN "escrowStatus" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_OPENED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_RESOLVED';

-- AlterEnum
ALTER TYPE "ShipmentStatus" ADD VALUE 'EXCEPTION';

-- AlterTable
ALTER TABLE "Shipment" ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "estimatedDelivery" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tradeId" TEXT;

-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "paymentFailedAt" TIMESTAMP(3),
ADD COLUMN     "stripeRefundId" TEXT,
ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeCustomerId" TEXT;

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" TEXT NOT NULL,
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "DisputeReason" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "adminNotes" TEXT,
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "refundAmount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradingAlert" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT,
    "userId" TEXT,
    "alertType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradingAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_tradeId_userId_key" ON "Dispute"("tradeId", "userId");

-- CreateIndex
CREATE INDEX "TradingAlert_alertType_reviewedAt_idx" ON "TradingAlert"("alertType", "reviewedAt");

-- CreateIndex
CREATE INDEX "Shipment_tradeId_idx" ON "Shipment"("tradeId");

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
