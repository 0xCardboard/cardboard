import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
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

  // For SELL orders: validate card instance ownership and status
  if (input.side === "SELL") {
    if (!input.cardInstanceId) {
      throw new AppError("VALIDATION_ERROR", "Sell orders require a card instance");
    }

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
      throw new AppError(
        "VALIDATION_ERROR",
        `Card instance must be VERIFIED to sell, current status: ${instance.status}`,
      );
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
      cardInstanceId: input.cardInstanceId ?? null,
      gradingCompany: input.gradingCompany ?? null,
      minGrade: input.minGrade ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    },
    include: ORDER_INCLUDE,
  });

  // Update card instance status to LISTED for sell orders
  if (input.side === "SELL" && input.cardInstanceId) {
    await prisma.cardInstance.update({
      where: { id: input.cardInstanceId },
      data: { status: "LISTED" },
    });
  }

  // Enqueue matching job
  await orderMatchingQueue.add("match", {
    orderId: order.id,
    orderBookId: orderBook.id,
    cardId: input.cardId,
  });

  return transformOrder(order);
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

  // Revert card instance status if this was a sell order
  if (order.side === "SELL" && order.cardInstanceId) {
    await prisma.cardInstance.update({
      where: { id: order.cardInstanceId },
      data: { status: "VERIFIED" },
    });
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
  return {
    id: order.id,
    side: order.side,
    type: order.type,
    price: order.price,
    quantity: order.quantity,
    filledQuantity: order.filledQuantity,
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
  };
}
