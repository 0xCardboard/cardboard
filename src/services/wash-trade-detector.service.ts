import { prisma } from "@/lib/db";
import { createNotification } from "@/services/notification.service";

interface WashTradeCheckResult {
  alertsCreated: number;
}

/**
 * Detects coordinated trading patterns after each trade.
 * Creates TradingAlert records and notifies admins on detection.
 */
export async function checkForWashTrading(
  tradeId: string,
): Promise<WashTradeCheckResult> {
  let alertsCreated = 0;

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      buyOrder: { include: { orderBook: true } },
      sellOrder: true,
    },
  });

  if (!trade) return { alertsCreated: 0 };

  const { buyerId, sellerId } = trade;

  // Rule 1: Rapid round-trip — same two users trading the same card back and forth within 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const roundTripTrades = await prisma.trade.count({
    where: {
      createdAt: { gte: sevenDaysAgo },
      buyOrder: { orderBookId: trade.buyOrder.orderBookId },
      OR: [
        { buyerId, sellerId },
        { buyerId: sellerId, sellerId: buyerId },
      ],
    },
  });

  if (roundTripTrades >= 2) {
    await createAlert(
      tradeId,
      buyerId,
      "RAPID_ROUND_TRIP",
      `Users ${buyerId} and ${sellerId} have traded the same card ${roundTripTrades} times in 7 days`,
      "HIGH",
    );
    alertsCreated++;
  }

  // Rule 2: Price manipulation — trade price >50% deviation from market price
  const card = await prisma.card.findFirst({
    where: {
      orderBook: { id: trade.buyOrder.orderBookId },
    },
  });

  if (card?.marketPrice && card.marketPrice > 0) {
    const deviation =
      Math.abs(trade.price - card.marketPrice) / card.marketPrice;
    if (deviation > 0.5) {
      await createAlert(
        tradeId,
        buyerId,
        "PRICE_MANIPULATION",
        `Trade price (${trade.price}) deviates ${Math.round(deviation * 100)}% from market price (${card.marketPrice})`,
        deviation > 1 ? "HIGH" : "MEDIUM",
      );
      alertsCreated++;
    }
  }

  // Rule 3: Volume anomaly — same user pair executing >5 trades in 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pairVolume = await prisma.trade.count({
    where: {
      createdAt: { gte: oneDayAgo },
      OR: [
        { buyerId, sellerId },
        { buyerId: sellerId, sellerId: buyerId },
      ],
    },
  });

  if (pairVolume > 5) {
    await createAlert(
      tradeId,
      buyerId,
      "VOLUME_ANOMALY",
      `User pair ${buyerId}/${sellerId} executed ${pairVolume} trades in the last 24 hours`,
      "MEDIUM",
    );
    alertsCreated++;
  }

  return { alertsCreated };
}

async function createAlert(
  tradeId: string,
  userId: string,
  alertType: string,
  description: string,
  severity: string,
): Promise<void> {
  await prisma.tradingAlert.create({
    data: {
      tradeId,
      userId,
      alertType,
      description,
      severity,
    },
  });

  // Notify all admins
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  for (const admin of admins) {
    await createNotification(
      admin.id,
      "SYSTEM",
      `Trading Alert: ${alertType}`,
      description,
      { tradeId, userId, alertType, severity },
    );
  }
}
