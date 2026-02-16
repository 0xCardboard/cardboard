import { prisma } from "@/lib/db";

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE || "0.03");

interface MatchResult {
  tradesCreated: number;
  ordersUpdated: number;
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

  if (!order) return { tradesCreated: 0, ordersUpdated: 0 };

  // Only match OPEN or PARTIALLY_FILLED orders
  if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") {
    return { tradesCreated: 0, ordersUpdated: 0 };
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
    await prisma.$transaction(async (tx) => {
      // Determine buyer and seller
      const buyOrder = order.side === "BUY" ? order : matchingOrder;
      const sellOrder = order.side === "SELL" ? order : matchingOrder;

      // Create trade
      const feeAmount = Math.round(tradePrice * fillQty * PLATFORM_FEE_RATE);

      await tx.trade.create({
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

    tradesCreated++;
    ordersUpdated += 2;
    remainingQty -= fillQty;
  }

  return { tradesCreated, ordersUpdated };
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
