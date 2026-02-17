import { prisma } from "@/lib/db";
import type { CardInstanceStatus } from "@/generated/prisma/client";

interface PortfolioSummary {
  totalCards: number;
  totalEstimatedValue: number; // cents
  cardsByStatus: Record<string, number>;
  cardsByGame: { gameId: string; gameName: string; count: number }[];
}

interface PortfolioInstance {
  id: string;
  certNumber: string;
  grade: number;
  gradingCompany: string;
  status: string;
  imageUrls: string[];
  verifiedAt: Date | null;
  createdAt: Date;
  card: {
    id: string;
    name: string;
    imageUrl: string | null;
    marketPrice: number | null;
    set: {
      id: string;
      name: string;
      game: { id: string; name: string };
    };
  };
}

interface PortfolioResult {
  instances: PortfolioInstance[];
  summary: PortfolioSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Statuses hidden from user-facing portfolio
const HIDDEN_STATUSES: CardInstanceStatus[] = ["SOLD"];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function getUserPortfolio(
  userId: string,
  filters: { status?: string; page?: number; limit?: number } = {},
): Promise<PortfolioResult> {
  const page = filters.page ?? DEFAULT_PAGE;
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    ownerId: userId,
    status: { notIn: HIDDEN_STATUSES },
  };

  if (filters.status) {
    where.status = filters.status;
  }

  const [instances, total] = await prisma.$transaction([
    prisma.cardInstance.findMany({
      where,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
            marketPrice: true,
            set: {
              select: {
                id: true,
                name: true,
                game: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.cardInstance.count({ where }),
  ]);

  // Compute summary across ALL user cards (not just current page)
  const allInstances = await prisma.cardInstance.findMany({
    where: {
      ownerId: userId,
      status: { notIn: HIDDEN_STATUSES },
    },
    select: {
      status: true,
      card: {
        select: {
          marketPrice: true,
          set: {
            select: {
              game: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  const cardsByStatus: Record<string, number> = {};
  const gameMap = new Map<string, { gameName: string; count: number }>();
  let totalEstimatedValue = 0;

  for (const inst of allInstances) {
    // Count by status
    cardsByStatus[inst.status] = (cardsByStatus[inst.status] ?? 0) + 1;

    // Sum estimated value
    if (inst.card.marketPrice) {
      totalEstimatedValue += inst.card.marketPrice;
    }

    // Count by game
    const gameId = inst.card.set.game.id;
    const existing = gameMap.get(gameId);
    if (existing) {
      existing.count++;
    } else {
      gameMap.set(gameId, { gameName: inst.card.set.game.name, count: 1 });
    }
  }

  const cardsByGame = Array.from(gameMap.entries()).map(([gameId, data]) => ({
    gameId,
    gameName: data.gameName,
    count: data.count,
  }));

  return {
    instances: instances as PortfolioInstance[],
    summary: {
      totalCards: allInstances.length,
      totalEstimatedValue,
      cardsByStatus,
      cardsByGame,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
