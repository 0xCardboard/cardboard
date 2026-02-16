import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { TradeWithDetails, TradeFilters } from "@/types/order";
import type { PaginatedResult } from "@/types/card";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const TRADE_INCLUDE = {
  buyOrder: {
    select: {
      id: true,
      orderBook: {
        select: {
          card: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  },
  sellOrder: {
    select: {
      id: true,
      cardInstance: {
        select: {
          id: true,
          certNumber: true,
          grade: true,
          gradingCompany: true,
        },
      },
    },
  },
  buyer: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  fee: { select: { amount: true, rate: true } },
} as const;

export async function getTradeById(tradeId: string): Promise<TradeWithDetails> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: TRADE_INCLUDE,
  });

  if (!trade) {
    throw new AppError("NOT_FOUND", `Trade not found: ${tradeId}`);
  }

  return transformTrade(trade);
}

export async function getUserTrades(
  userId: string,
  filters: TradeFilters,
): Promise<PaginatedResult<TradeWithDetails>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    OR: [{ buyerId: userId }, { sellerId: userId }],
  };

  if (filters.cardId) {
    where.buyOrder = { orderBook: { cardId: filters.cardId } };
  }

  const [data, total] = await prisma.$transaction([
    prisma.trade.findMany({
      where,
      include: TRADE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.trade.count({ where }),
  ]);

  return {
    data: data.map(transformTrade),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getTradesByCard(
  cardId: string,
  filters: TradeFilters,
): Promise<PaginatedResult<TradeWithDetails>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  const where = {
    buyOrder: { orderBook: { cardId } },
  };

  const [data, total] = await prisma.$transaction([
    prisma.trade.findMany({
      where,
      include: TRADE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.trade.count({ where }),
  ]);

  return {
    data: data.map(transformTrade),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformTrade(trade: any): TradeWithDetails {
  return {
    id: trade.id,
    price: trade.price,
    quantity: trade.quantity,
    escrowStatus: trade.escrowStatus,
    createdAt: trade.createdAt,
    buyOrder: {
      id: trade.buyOrder.id,
      card: trade.buyOrder.orderBook.card,
    },
    sellOrder: {
      id: trade.sellOrder.id,
      cardInstance: trade.sellOrder.cardInstance,
    },
    buyer: trade.buyer,
    seller: trade.seller,
    fee: trade.fee,
  };
}
