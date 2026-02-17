import { prisma } from "@/lib/db";
import { processTradePayment } from "@/services/escrow.service";
import { createNotification } from "@/services/notification.service";
import { washTradeDetectionQueue } from "@/jobs/queue";
import { publish } from "@/lib/websocket";

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE || "0.05");

interface MatchResult {
  tradesCreated: number;
  ordersUpdated: number;
  cancelledRemainder: number;
}

/**
 * Matches an incoming order against the opposite side of the order book.
 * Uses price-time priority: best price first, then earliest order.
 * Handles partial fills.
 */
export async function matchOrder(orderId: string): Promise<MatchResult> {
  let tradesCreated = 0;
  let ordersUpdated = 0;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderBook: true },
  });

  if (!order) return { tradesCreated: 0, ordersUpdated: 0, cancelledRemainder: 0 };

  // Only match OPEN or PARTIALLY_FILLED orders
  if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") {
    return { tradesCreated: 0, ordersUpdated: 0, cancelledRemainder: 0 };
  }

  let remainingQty = order.quantity - order.filledQuantity;

  while (remainingQty > 0) {
    // Find the best matching order on the opposite side
    const matchingOrder = await findBestMatch(order);

    if (!matchingOrder) break;

    const fillQty = Math.min(
      remainingQty,
      matchingOrder.quantity - matchingOrder.filledQuantity,
    );

    // Determine trade price (taker/maker: the resting order's price)
    const tradePrice = matchingOrder.price!;

    // Execute the trade in a transaction
    let tradeId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // Determine buyer and seller
      const buyOrder = order.side === "BUY" ? order : matchingOrder;
      const sellOrder = order.side === "SELL" ? order : matchingOrder;

      // Create trade
      const feeAmount = Math.round(tradePrice * fillQty * PLATFORM_FEE_RATE);

      const trade = await tx.trade.create({
        data: {
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          price: tradePrice,
          quantity: fillQty,
          buyerId: buyOrder.userId,
          sellerId: sellOrder.userId,
          escrowStatus: "PENDING",
          fee: {
            create: {
              amount: feeAmount,
              rate: PLATFORM_FEE_RATE,
            },
          },
        },
      });

      tradeId = trade.id;

      // Update the incoming order
      const newFilledQty = order.filledQuantity + (order.quantity - order.filledQuantity - remainingQty + fillQty);
      const incomingStatus =
        newFilledQty >= order.quantity ? "FILLED" : "PARTIALLY_FILLED";

      await tx.order.update({
        where: { id: order.id },
        data: {
          filledQuantity: newFilledQty,
          status: incomingStatus,
        },
      });

      // Update the matching (resting) order
      const matchNewFilled = matchingOrder.filledQuantity + fillQty;
      const matchStatus =
        matchNewFilled >= matchingOrder.quantity ? "FILLED" : "PARTIALLY_FILLED";

      await tx.order.update({
        where: { id: matchingOrder.id },
        data: {
          filledQuantity: matchNewFilled,
          status: matchStatus,
        },
      });

      // Mark card instance as pending shipment — seller must ship to company.
      // Ownership transfers only after verification (handled in settlement flow).
      if (sellOrder.cardInstanceId) {
        await tx.cardInstance.update({
          where: { id: sellOrder.cardInstanceId },
          data: { status: "PENDING_SHIPMENT" },
        });
      }
    });

    // Process payment outside the DB transaction (Stripe API calls should not be in transactions)
    if (tradeId) {
      processTradePayment(tradeId).catch(() => {
        // Payment processing is handled async — failure enqueues retry via BullMQ
      });

      // Enqueue wash trade detection
      washTradeDetectionQueue
        .add("check-wash-trade", { tradeId })
        .catch(() => {});

      // Publish real-time updates via WebSocket
      const cardId = order.orderBook.cardId;
      try {
        publish(`trades:${cardId}`, {
          tradeId,
          price: tradePrice,
          quantity: fillQty,
          timestamp: new Date().toISOString(),
        });
        publish(`orderbook:${cardId}`, {
          event: "trade",
          tradeId,
          price: tradePrice,
          quantity: fillQty,
        });
      } catch {
        // WebSocket server may not be running
      }
    }

    tradesCreated++;
    ordersUpdated += 2;
    remainingQty -= fillQty;
  }

  // Fill-or-kill: market orders that can't fully fill get their remainder cancelled
  let cancelledRemainder = 0;
  if (order.type === "MARKET" && remainingQty > 0) {
    cancelledRemainder = remainingQty;
    const filledQty = order.quantity - remainingQty;

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    if (filledQty > 0) {
      await createNotification(
        order.userId,
        "ORDER_CANCELLED",
        "Market Order Partially Filled",
        `Your market ${order.side} order was partially filled (${filledQty}/${order.quantity}). The remaining ${remainingQty} cancelled due to insufficient liquidity.`,
        { orderId: order.id, filledQty, cancelledQty: remainingQty },
      );
    } else {
      await createNotification(
        order.userId,
        "ORDER_CANCELLED",
        "Market Order Cancelled",
        `Your market ${order.side} order was cancelled — no matching orders available.`,
        { orderId: order.id },
      );
    }
  }

  // Publish order book update for any order changes
  if (tradesCreated > 0 || cancelledRemainder > 0) {
    try {
      publish(`orderbook:${order.orderBook.cardId}`, {
        event: "update",
        orderId: order.id,
      });
    } catch {
      // WebSocket server may not be running
    }
  }

  return { tradesCreated, ordersUpdated, cancelledRemainder };
}

/**
 * Finds the best matching order on the opposite side using price-time priority.
 */
async function findBestMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any,
) {
  const oppositeSide = order.side === "BUY" ? "SELL" : "BUY";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    orderBookId: order.orderBookId,
    side: oppositeSide,
    status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    userId: { not: order.userId }, // can't self-trade
  };

  // Price matching logic
  if (order.type === "LIMIT") {
    if (order.side === "BUY") {
      // Buy limit: match asks where ask price <= bid price
      where.price = { lte: order.price };
    } else {
      // Sell limit: match bids where bid price >= ask price
      where.price = { gte: order.price };
    }
  } else {
    // Market orders: match any price on opposite side
    where.price = { not: null };
  }

  // For BUY orders: apply grading filters if specified
  if (order.side === "BUY" && order.gradingCompany) {
    where.cardInstance = {
      ...where.cardInstance,
      gradingCompany: order.gradingCompany,
    };
  }
  if (order.side === "BUY" && order.minGrade !== null && order.minGrade !== undefined) {
    where.cardInstance = {
      ...where.cardInstance,
      grade: { gte: order.minGrade },
    };
  }

  // Sort: best price first (lowest ask for BUY, highest bid for SELL), then by time
  const orderBy =
    order.side === "BUY"
      ? [{ price: "asc" as const }, { createdAt: "asc" as const }]
      : [{ price: "desc" as const }, { createdAt: "asc" as const }];

  return prisma.order.findFirst({
    where,
    orderBy,
  });
}
