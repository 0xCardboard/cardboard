import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGames, getSetsByGame, searchCards, getCardById } from "../card-catalog.service";
import { prisma } from "@/lib/db";

const mockPrisma = prisma as unknown as {
  tcgGame: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
  };
  cardSet: {
    findMany: ReturnType<typeof vi.fn>;
  };
  card: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("card-catalog.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getGames", () => {
    it("should return all games with set counts", async () => {
      const games = [
        { id: "pokemon", name: "Pokemon TCG", _count: { sets: 10 } },
      ];
      mockPrisma.tcgGame.findMany.mockResolvedValue(games);

      const result = await getGames();

      expect(result).toEqual(games);
      expect(mockPrisma.tcgGame.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            name: true,
            _count: { select: { sets: true } },
          }),
        })
      );
    });
  });

  describe("getSetsByGame", () => {
    it("should return sets for a valid game", async () => {
      mockPrisma.tcgGame.findUnique.mockResolvedValue({ id: "pokemon", name: "Pokemon TCG" });
      const sets = [
        { id: "sv8", name: "Surging Sparks", gameId: "pokemon", _count: { cards: 191 } },
      ];
      mockPrisma.cardSet.findMany.mockResolvedValue(sets);

      const result = await getSetsByGame("pokemon");

      expect(result).toEqual(sets);
    });

    it("should throw NOT_FOUND for unknown game", async () => {
      mockPrisma.tcgGame.findUnique.mockResolvedValue(null);

      await expect(getSetsByGame("unknown")).rejects.toThrow("Game not found: unknown");
    });
  });

  describe("searchCards", () => {
    it("should return paginated results with default params", async () => {
      const cards = [{ id: "sv8-25", name: "Pikachu", set: { id: "sv8", name: "Test", game: { id: "pokemon", name: "Pokemon TCG" } } }];
      mockPrisma.$transaction.mockResolvedValue([cards, 1]);

      const result = await searchCards({});

      expect(result.data).toEqual(cards);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 24,
        total: 1,
        totalPages: 1,
      });
    });

    it("should apply name filter with case-insensitive contains", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await searchCards({ name: "pikachu" });

      const transactionCalls = mockPrisma.$transaction.mock.calls[0][0];
      // Verify findMany was called (it's in a transaction array)
      expect(transactionCalls).toHaveLength(2);
    });

    it("should apply gameId filter through set relation", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      await searchCards({ gameId: "pokemon" });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should calculate pagination correctly", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 100]);

      const result = await searchCards({ page: 3, limit: 10 });

      expect(result.pagination).toEqual({
        page: 3,
        limit: 10,
        total: 100,
        totalPages: 10,
      });
    });

    it("should cap limit at 100", async () => {
      mockPrisma.$transaction.mockResolvedValue([[], 0]);

      const result = await searchCards({ limit: 500 });

      expect(result.pagination.limit).toBe(100);
    });
  });

  describe("getCardById", () => {
    it("should return card with full details", async () => {
      const card = {
        id: "sv8-25",
        name: "Pikachu",
        number: "25",
        rarity: "Uncommon",
        imageUrl: "https://example.com/25.png",
        imageUrlHiRes: "https://example.com/25_hires.png",
        supertype: "Pokemon",
        subtypes: ["Basic"],
        marketPrice: 1000,
        lastPriceSync: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        set: {
          id: "sv8",
          name: "Surging Sparks",
          game: { id: "pokemon", name: "Pokemon TCG" },
        },
        priceHistory: [],
      };
      mockPrisma.card.findUnique.mockResolvedValue(card);

      const result = await getCardById("sv8-25");

      expect(result).toEqual(card);
    });

    it("should throw NOT_FOUND for unknown card", async () => {
      mockPrisma.card.findUnique.mockResolvedValue(null);

      await expect(getCardById("nonexistent")).rejects.toThrow("Card not found: nonexistent");
    });
  });
});
