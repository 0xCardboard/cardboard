import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  getTradeById,
  getUserTrades,
  getTradesByCard,
} from "@/services/trade.service";

const mockTrade = {
  id: "trade-1",
  price: 5000,
  quantity: 1,
  escrowStatus: "PENDING",
  createdAt: new Date(),
  buyOrder: {
    id: "buy-1",
    orderBook: {
      card: { id: "card-1", name: "Charizard", imageUrl: null },
    },
  },
  sellOrder: {
    id: "sell-1",
    cardInstance: {
      id: "inst-1",
      certNumber: "12345678",
      grade: 9.5,
      gradingCompany: "PSA",
    },
  },
  buyer: { id: "buyer-1", name: "Buyer" },
  seller: { id: "seller-1", name: "Seller" },
  fee: { amount: 150, rate: 0.03 },
};

describe("trade.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTradeById", () => {
    it("returns a trade with details", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockTrade);

      const result = await getTradeById("trade-1");
      expect(result.id).toBe("trade-1");
      expect(result.price).toBe(5000);
      expect(result.buyOrder.card.name).toBe("Charizard");
      expect(result.fee?.amount).toBe(150);
    });

    it("throws NOT_FOUND for missing trade", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getTradeById("nonexistent")).rejects.toThrow("Trade not found");
    });
  });

  describe("getUserTrades", () => {
    it("returns paginated user trades", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [mockTrade],
        1,
      ]);

      const result = await getUserTrades("buyer-1", {});
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it("caps limit at 100", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([[], 0]);

      const result = await getUserTrades("buyer-1", { limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });
  });

  describe("getTradesByCard", () => {
    it("returns trades for a specific card", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [mockTrade],
        1,
      ]);

      const result = await getTradesByCard("card-1", {});
      expect(result.data).toHaveLength(1);
      expect(result.data[0].buyOrder.card.name).toBe("Charizard");
    });
  });
});
