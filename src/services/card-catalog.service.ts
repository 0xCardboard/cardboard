import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type {
  CardFilters,
  PaginatedResult,
  CardWithSet,
  CardDetail,
  GameWithSetCount,
  SetWithCardCount,
} from "@/types/card";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function getGames(): Promise<GameWithSetCount[]> {
  return prisma.tcgGame.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { sets: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getSetsByGame(gameId: string): Promise<SetWithCardCount[]> {
  const game = await prisma.tcgGame.findUnique({ where: { id: gameId } });
  if (!game) {
    throw new AppError("NOT_FOUND", `Game not found: ${gameId}`);
  }

  return prisma.cardSet.findMany({
    where: { gameId },
    select: {
      id: true,
      name: true,
      gameId: true,
      releaseDate: true,
      totalCards: true,
      logoUrl: true,
      _count: { select: { cards: true } },
    },
    orderBy: { releaseDate: "desc" },
  });
}

export async function searchCards(filters: CardFilters): Promise<PaginatedResult<CardWithSet>> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // Build where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (filters.gameId) {
    where.set = { ...where.set, gameId: filters.gameId };
  }
  if (filters.setId) {
    where.setId = filters.setId;
  }
  if (filters.name) {
    where.name = { contains: filters.name, mode: "insensitive" };
  }
  if (filters.rarity) {
    where.rarity = filters.rarity;
  }
  if (filters.supertype) {
    where.supertype = filters.supertype;
  }

  // Build orderBy
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orderBy: Record<string, any> = { name: "asc" };
  const sortOrder = filters.sortOrder ?? "asc";

  switch (filters.sortBy) {
    case "name":
      orderBy = { name: sortOrder };
      break;
    case "price":
      orderBy = { marketPrice: sortOrder };
      break;
    case "number":
      orderBy = { number: sortOrder };
      break;
    case "newest":
      orderBy = { createdAt: "desc" };
      break;
  }

  const [data, total] = await prisma.$transaction([
    prisma.card.findMany({
      where,
      select: {
        id: true,
        name: true,
        number: true,
        rarity: true,
        imageUrl: true,
        marketPrice: true,
        set: {
          select: {
            id: true,
            name: true,
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.card.count({ where }),
  ]);

  return {
    data: data as CardWithSet[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getCardById(cardId: string): Promise<CardDetail> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      id: true,
      name: true,
      number: true,
      rarity: true,
      imageUrl: true,
      imageUrlHiRes: true,
      supertype: true,
      subtypes: true,
      marketPrice: true,
      lastPriceSync: true,
      createdAt: true,
      updatedAt: true,
      set: {
        select: {
          id: true,
          name: true,
          game: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      priceHistory: {
        select: {
          price: true,
          timestamp: true,
        },
        orderBy: { timestamp: "desc" },
        take: 30,
      },
    },
  });

  if (!card) {
    throw new AppError("NOT_FOUND", `Card not found: ${cardId}`);
  }

  return card as CardDetail;
}
