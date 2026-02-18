-- AlterTable
ALTER TABLE "Trade" ADD COLUMN     "shipDeadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifyTradeFilled" BOOLEAN NOT NULL DEFAULT true,
    "notifyOrderUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyCardVerified" BOOLEAN NOT NULL DEFAULT true,
    "notifyEscrowReleased" BOOLEAN NOT NULL DEFAULT true,
    "notifyShipmentUpdate" BOOLEAN NOT NULL DEFAULT true,
    "notifyDisputeUpdate" BOOLEAN NOT NULL DEFAULT true,
    "notifyPriceAlerts" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewListings" BOOLEAN NOT NULL DEFAULT true,
    "notifyLendingUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifyAnnouncements" BOOLEAN NOT NULL DEFAULT true,
    "emailDigest" BOOLEAN NOT NULL DEFAULT true,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "profilePublic" BOOLEAN NOT NULL DEFAULT true,
    "showTradeHistory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
