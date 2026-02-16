import { describe, it, expect, vi, beforeEach } from "vitest";
import { fullSync, setSync, priceSync, runSync } from "../card-sync.service";
import { prisma } from "@/lib/db";

// Mock the adapter registry
vi.mock("../sync", () => {
  const mockAdapter = {
    gameId: "pokemon",
    gameName: "Pokemon TCG",
    fetchSets: vi.fn(),
    fetchCards: vi.fn(),
  };

  return {
    getAdapter: vi.fn((gameId: string) => {
      if (gameId === "pokemon") return mockAdapter;
      if (gameId === "unknown") throw new Error("Not found");
      return mockAdapter;
    }),
    getAllAdapters: vi.fn(() => [mockAdapter]),
    __mockAdapter: mockAdapter,
  };
});

// Import mocked adapter for assertions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { __mockAdapter: mockAdapter } = await import("../sync") as any;

const mockPrisma = prisma as unknown as {
  tcgGame: { upsert: ReturnType<typeof vi.fn> };
  cardSet: { upsert: ReturnType<typeof vi.fn> };
  card: { upsert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

describe("card-sync.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.tcgGame.upsert.mockResolvedValue({});
    mockPrisma.cardSet.upsert.mockResolvedValue({});
    mockPrisma.card.upsert.mockResolvedValue({});
    mockPrisma.card.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (ops: unknown[]) => {
      // Resolve all promises in the array
      return Promise.all(ops);
    });
  });

  describe("runSync", () => {
    it("should dispatch to fullSync for FULL_SYNC", async () => {
      mockAdapter.fetchSets.mockResolvedValue([]);

      const result = await runSync({ type: "FULL_SYNC" });

      expect(result.gamesProcessed).toBe(1);
    });

    it("should throw for SET_SYNC without gameId/setId", async () => {
      await expect(runSync({ type: "SET_SYNC" })).rejects.toThrow("SET_SYNC requires gameId and setId");
    });

    it("should throw for unknown sync type", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(runSync({ type: "INVALID" as any })).rejects.toThrow("Unknown sync type");
    });
  });

  describe("fullSync", () => {
    it("should upsert game, sets, and cards", async () => {
      mockAdapter.fetchSets.mockResolvedValue([
        { id: "sv8", name: "Surging Sparks", releaseDate: "2024-11-08", totalCards: 191 },
      ]);
      mockAdapter.fetchCards.mockResolvedValue([
        { id: "sv8-25", name: "Pikachu", setId: "sv8", number: "25", rarity: "Uncommon", marketPrice: 0.1 },
      ]);

      const result = await fullSync("pokemon");

      expect(result.gamesProcessed).toBe(1);
      expect(result.setsProcessed).toBe(1);
      expect(result.cardsUpserted).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      expect(mockPrisma.tcgGame.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "pokemon" },
          create: { id: "pokemon", name: "Pokemon TCG" },
        })
      );

      expect(mockPrisma.cardSet.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sv8" },
          create: expect.objectContaining({ id: "sv8", name: "Surging Sparks", gameId: "pokemon" }),
        })
      );
    });

    it("should convert market price from dollars to cents", async () => {
      mockAdapter.fetchSets.mockResolvedValue([{ id: "sv8", name: "Test", totalCards: 1 }]);
      mockAdapter.fetchCards.mockResolvedValue([
        { id: "sv8-1", name: "Card", setId: "sv8", marketPrice: 12.34 },
      ]);

      await fullSync("pokemon");

      // The $transaction receives upsert promises, check the card upsert was called
      expect(mockPrisma.card.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ marketPrice: 1234 }),
          update: expect.objectContaining({ marketPrice: 1234 }),
        })
      );
    });

    it("should continue on per-set errors", async () => {
      mockAdapter.fetchSets.mockResolvedValue([
        { id: "set1", name: "Set 1" },
        { id: "set2", name: "Set 2" },
      ]);
      mockAdapter.fetchCards
        .mockRejectedValueOnce(new Error("API timeout"))
        .mockResolvedValueOnce([{ id: "set2-1", name: "Card", setId: "set2" }]);

      // Make cardSet upsert succeed for both
      mockPrisma.cardSet.upsert.mockResolvedValue({});

      const result = await fullSync("pokemon");

      // Both sets were upserted, but set1's cards failed to sync
      expect(result.setsProcessed).toBe(2);
      expect(result.cardsUpserted).toBe(1); // Only set2's card was upserted
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("set1");
    });
  });

  describe("setSync", () => {
    it("should sync cards for a single set", async () => {
      mockAdapter.fetchCards.mockResolvedValue([
        { id: "sv8-1", name: "Card 1", setId: "sv8" },
        { id: "sv8-2", name: "Card 2", setId: "sv8" },
      ]);

      const result = await setSync("pokemon", "sv8");

      expect(result.setsProcessed).toBe(1);
      expect(result.cardsUpserted).toBe(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("priceSync", () => {
    it("should update only prices for cards with market price", async () => {
      mockAdapter.fetchSets.mockResolvedValue([{ id: "sv8", name: "Test" }]);
      mockAdapter.fetchCards.mockResolvedValue([
        { id: "sv8-1", name: "Card 1", setId: "sv8", marketPrice: 5.5 },
        { id: "sv8-2", name: "Card 2", setId: "sv8" }, // no market price
      ]);

      const result = await priceSync("pokemon");

      expect(result.cardsUpserted).toBe(1); // Only one had a market price
      expect(mockPrisma.card.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "sv8-1" },
          data: expect.objectContaining({ marketPrice: 550 }),
        })
      );
      expect(mockPrisma.card.update).toHaveBeenCalledTimes(1);
    });
  });
});
