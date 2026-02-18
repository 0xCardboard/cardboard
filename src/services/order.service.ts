import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { matchOrder } from "@/services/matching.service";
import { orderMatchingQueue } from "@/jobs/queue";
import type {
  PlaceOrderInput,
  OrderWithDetails,
  OrderBookSnapshot,
  OrderBookEntry,
  UserOrderFilters,
} from "@/types/order";
import type { PaginatedResult } from "@/types/card";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ORDER_INCLUDE = {
  orderBook: {
    select: {
      card: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          set: { select: { id: true, name: true } },
        },
      },
    },
  },
  cardInstance: {
    select: {
      id: true,
      certNumber: true,
      grade: true,
      gradingCompany: true,
    },
  },
  buyTrades: { select: { id: true, price: true, quantity: true, escrowStatus: true, shipDeadline: true, createdAt: true } },
  sellTrades: { select: { id: true, price: true, quantity: true, escrowStatus: true, shipDeadline: true, createdAt: true } },
} as const;

export async function placeOrder(
  userId: string,
  input: PlaceOrderInput,
): Promise<OrderWithDetails> {
  // Validate card exists
  const card = await prisma.card.findUnique({ where: { id: input.cardId } });
  if (!card) {
    throw new AppError("NOT_FOUND", `Card not found: ${input.cardId}`);
  }

  // BUY orders require a payment method on file
  if (input.side === "BUY") {
    const defaultPm = await prisma.paymentMethod.findFirst({
      where: { userId, isDefault: true },
    });
    if (!defaultPm) {
      throw new AppError(
        "VALIDATION_ERROR",
        "A payment method is required to place buy orders. Add a card first.",
      );
    }
  }

  const quantity = input.quantity ?? 1;
  if (quantity < 1) {
    throw new AppError("VALIDATION_ERROR", "Quantity must be at least 1");
  }

  // Validate LIMIT orders require a price
  if (input.type === "LIMIT" && (input.price === undefined || input.price === null)) {
    throw new AppError("VALIDATION_ERROR", "Limit orders require a price");
  }

  if (input.price !== undefined && input.price <= 0) {
    throw new AppError("VALIDATION_ERROR", "Price must be positive");
  }

  // Idempotency check
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      return transformOrder(existing);
    }
  }

  // For SELL orders: create or reference a card instance
  let cardInstanceId: string | null = null;

  if (input.side === "SELL") {
    if (input.cardInstanceId) {
      // Path B: Seller references an existing card instance they already deposited
      const instance = await prisma.cardInstance.findUnique({
        where: { id: input.cardInstanceId },
      });

      if (!instance) {
        throw new AppError("NOT_FOUND", `Card instance not found: ${input.cardInstanceId}`);
      }

      if (instance.ownerId !== userId) {
        throw new AppError("FORBIDDEN", "You do not own this card instance");
      }

      if (instance.cardId !== input.cardId) {
        throw new AppError("VALIDATION_ERROR", "Card instance does not match the specified card");
      }

      if (instance.status !== "VERIFIED") {
        throw new AppError("VALIDATION_ERROR", "Card instance must be VERIFIED to sell");
      }

      // Check if card is already listed in another open order
      const existingOrder = await prisma.order.findFirst({
        where: {
          cardInstanceId: input.cardInstanceId,
          status: { in: ["OPEN", "PARTIALLY_FILLED"] },
        },
      });

      if (existingOrder) {
        throw new AppError("CONFLICT", "Card instance is already listed in an open order");
      }

      cardInstanceId = input.cardInstanceId;
    } else {
      // Path A: Seller lists a physical card they have — create a new card instance
      if (!input.certNumber || !input.gradingCompany || input.grade === undefined) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Sell orders require certNumber, gradingCompany, and grade",
        );
      }

      // Only PSA graded cards accepted at launch
      if (input.gradingCompany !== "PSA") {
        throw new AppError(
          "VALIDATION_ERROR",
          "Only PSA graded cards are accepted at this time. BGS and CGC support coming soon.",
        );
      }

      if (input.grade < 1 || input.grade > 10) {
        throw new AppError("VALIDATION_ERROR", "Grade must be between 1 and 10");
      }

      // Check cert number uniqueness
      const existingCert = await prisma.cardInstance.findUnique({
        where: { certNumber: input.certNumber },
      });

      if (existingCert) {
        throw new AppError("CONFLICT", `Cert number already registered: ${input.certNumber}`);
      }

      // Create card instance with LISTED status (seller still has physical card)
      const newInstance = await prisma.cardInstance.create({
        data: {
          cardId: input.cardId,
          ownerId: userId,
          gradingCompany: input.gradingCompany,
          certNumber: input.certNumber,
          grade: input.grade,
          status: "LISTED",
        },
      });

      cardInstanceId = newInstance.id;
    }
  }

  // Upsert order book for this card
  const orderBook = await prisma.orderBook.upsert({
    where: { cardId: input.cardId },
    create: { cardId: input.cardId },
    update: {},
  });

  // Create the order
  const order = await prisma.order.create({
    data: {
      orderBookId: orderBook.id,
      userId,
      side: input.side,
      type: input.type,
      price: input.price ?? null,
      quantity,
      filledQuantity: 0,
      status: "OPEN",
      cardInstanceId: cardInstanceId,
      gradingCompany: input.side === "BUY" ? (input.gradingCompany ?? null) : null,
      minGrade: input.side === "BUY" ? (input.minGrade ?? null) : null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
    include: ORDER_INCLUDE,
  });

  // For Path B sell orders with existing instances, update status to LISTED
  if (input.side === "SELL" && input.cardInstanceId) {
    await prisma.cardInstance.update({
      where: { id: input.cardInstanceId },
      data: { status: "LISTED" },
    });
  }

  // Run matching inline so orders fill immediately
  const matchResult = await matchOrder(order.id);

  // Also enqueue a background job as a safety-net retry (best-effort, non-blocking)
  orderMatchingQueue
    .add("match", {
      orderId: order.id,
      orderBookId: orderBook.id,
      cardId: input.cardId,
    })
    .catch(() => {
      // Queue unavailable — inline matching above already handled the match
    });

  // Re-fetch the order to reflect any fills from matching
  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { ...ORDER_INCLUDE, cardInstance: true },
  });

  // If a market sell order was cancelled (fill-or-kill), clean up the card instance
  if (
    matchResult.cancelledRemainder > 0 &&
    input.side === "SELL" &&
    updatedOrder?.status === "CANCELLED" &&
    updatedOrder.cardInstanceId
  ) {
    if (updatedOrder.cardInstance && !updatedOrder.cardInstance.verifiedAt) {
      // Path A: card was never shipped/verified, safe to delete
      await prisma.cardInstance.delete({ where: { id: updatedOrder.cardInstanceId } });
    } else if (updatedOrder.cardInstance) {
      // Path B: revert verified card back to VERIFIED
      await prisma.cardInstance.update({
        where: { id: updatedOrder.cardInstanceId },
        data: { status: "VERIFIED" },
      });
    }
  }

  // Re-fetch again after potential cleanup
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: ORDER_INCLUDE,
  });

  return transformOrder(finalOrder ?? updatedOrder ?? order);
}

export async function cancelOrder(
  userId: string,
  orderId: string,
): Promise<OrderWithDetails> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { ...ORDER_INCLUDE, cardInstance: true },
  });

  if (!order) {
    throw new AppError("NOT_FOUND", `Order not found: ${orderId}`);
  }

  if (order.userId !== userId) {
    throw new AppError("FORBIDDEN", "You do not own this order");
  }

  if (order.status !== "OPEN" && order.status !== "PARTIALLY_FILLED") {
    throw new AppError("VALIDATION_ERROR", `Cannot cancel order with status: ${order.status}`);
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
    include: ORDER_INCLUDE,
  });

  // Handle card instance cleanup for cancelled sell orders
  if (order.side === "SELL" && order.cardInstanceId && order.cardInstance) {
    if (order.cardInstance.status === "LISTED" && !order.cardInstance.verifiedAt) {
      // Path A listing: card was never shipped/verified, safe to delete
      await prisma.cardInstance.delete({ where: { id: order.cardInstanceId } });
    } else {
      // Path B listing: revert verified card back to VERIFIED
      await prisma.cardInstance.update({
        where: { id: order.cardInstanceId },
        data: { status: "VERIFIED" },
      });
    }
  }

  return transformOrder(updated);
}

export async function getOrderById(orderId: string): Promise<OrderWithDetails> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });

  if (!order) {
    throw new AppError("NOT_FOUND", `Order not found: ${orderId}`);
  }

  return transformOrder(order);
}

export async function getUserOrders(
  userId: string,
  filters: UserOrderFilters,
): Promise<PaginatedResult<OrderWithDetails>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId };

  if (filters.side) where.side = filters.side;
  if (filters.status) where.status = filters.status;
  if (filters.cardId) where.orderBook = { cardId: filters.cardId };

  const [data, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: data.map(transformOrder),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getOrderBook(cardId: string): Promise<OrderBookSnapshot> {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) {
    throw new AppError("NOT_FOUND", `Card not found: ${cardId}`);
  }

  const orderBook = await prisma.orderBook.findUnique({ where: { cardId } });

  if (!orderBook) {
    return { cardId, bids: [], asks: [], spread: null, lastTradePrice: null, lastTradeTime: null };
  }

  // Get aggregated bids (BUY orders, sorted by price DESC)
  const bids = await prisma.order.groupBy({
    by: ["price"],
    where: {
      orderBookId: orderBook.id,
      side: "BUY",
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      price: { not: null },
    },
    _sum: { quantity: true, filledQuantity: true },
    _count: true,
    orderBy: { price: "desc" },
  });

  // Get aggregated asks (SELL orders, sorted by price ASC)
  const asks = await prisma.order.groupBy({
    by: ["price"],
    where: {
      orderBookId: orderBook.id,
      side: "SELL",
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      price: { not: null },
    },
    _sum: { quantity: true, filledQuantity: true },
    _count: true,
    orderBy: { price: "asc" },
  });

  // Get last trade
  const lastTrade = await prisma.trade.findFirst({
    where: {
      buyOrder: { orderBookId: orderBook.id },
    },
    orderBy: { createdAt: "desc" },
    select: { price: true, createdAt: true },
  });

  const bidEntries: OrderBookEntry[] = bids.map((b) => ({
    price: b.price!,
    quantity: (b._sum.quantity ?? 0) - (b._sum.filledQuantity ?? 0),
    orderCount: b._count,
  }));

  const askEntries: OrderBookEntry[] = asks.map((a) => ({
    price: a.price!,
    quantity: (a._sum.quantity ?? 0) - (a._sum.filledQuantity ?? 0),
    orderCount: a._count,
  }));

  // Calculate spread
  const bestBid = bidEntries[0]?.price ?? null;
  const bestAsk = askEntries[0]?.price ?? null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;

  return {
    cardId,
    bids: bidEntries,
    asks: askEntries,
    spread,
    lastTradePrice: lastTrade?.price ?? null,
    lastTradeTime: lastTrade?.createdAt?.toISOString() ?? null,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformOrder(order: any): OrderWithDetails {
  // Compute weighted average fill price from trades
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trades: any[] =
    order.side === "BUY" ? (order.buyTrades ?? []) : (order.sellTrades ?? []);
  let avgFillPrice: number | null = null;
  if (trades.length > 0) {
    const totalQty = trades.reduce((sum: number, t: { quantity: number }) => sum + t.quantity, 0);
    const totalValue = trades.reduce(
      (sum: number, t: { price: number; quantity: number }) => sum + t.price * t.quantity,
      0,
    );
    avgFillPrice = totalQty > 0 ? Math.round(totalValue / totalQty) : null;
  }

  return {
    id: order.id,
    side: order.side,
    type: order.type,
    price: order.price,
    quantity: order.quantity,
    filledQuantity: order.filledQuantity,
    avgFillPrice,
    status: order.status,
    gradingCompany: order.gradingCompany,
    minGrade: order.minGrade,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    card: order.orderBook.card,
    cardInstance: order.cardInstance
      ? {
          id: order.cardInstance.id,
          certNumber: order.cardInstance.certNumber,
          grade: order.cardInstance.grade,
          gradingCompany: order.cardInstance.gradingCompany,
        }
      : null,
    trade: trades.length > 0
      ? {
          id: trades[0].id,
          escrowStatus: trades[0].escrowStatus,
          shipDeadline: trades[0].shipDeadline?.toISOString?.() ?? trades[0].shipDeadline ?? null,
          createdAt: trades[0].createdAt?.toISOString?.() ?? trades[0].createdAt,
        }
      : null,
  };
}
