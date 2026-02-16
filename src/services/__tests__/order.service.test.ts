import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  placeOrder,
  cancelOrder,
  getOrderBook,
  getUserOrders,
} from "@/services/order.service";

// Mock BullMQ queue
vi.mock("@/jobs/queue", () => ({
  orderMatchingQueue: {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  },
  QUEUE_NAMES: { ORDER_MATCHING: "order-matching" },
}));

const mockOrderBook = { id: "ob-1", cardId: "card-1" };

const mockOrder = {
  id: "order-1",
  orderBookId: "ob-1",
  userId: "user-1",
  side: "BUY",
  type: "LIMIT",
  price: 5000,
  quantity: 1,
  filledQuantity: 0,
  status: "OPEN",
  gradingCompany: null,
  minGrade: null,
  cardInstanceId: null,
  idempotencyKey: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  orderBook: {
    card: {
      id: "card-1",
      name: "Charizard",
      imageUrl: null,
      set: { id: "sv8", name: "Surging Sparks" },
    },
  },
  cardInstance: null,
};

describe("order.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("placeOrder", () => {
    it("creates a BUY LIMIT order", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.orderBook.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrderBook);
      (prisma.order.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      const result = await placeOrder("user-1", {
        cardId: "card-1",
        side: "BUY",
        type: "LIMIT",
        price: 5000,
      });

      expect(result.id).toBe("order-1");
      expect(result.side).toBe("BUY");
      expect(result.price).toBe(5000);
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it("throws NOT_FOUND when card does not exist", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        placeOrder("user-1", {
          cardId: "nonexistent",
          side: "BUY",
          type: "LIMIT",
          price: 5000,
        }),
      ).rejects.toThrow("Card not found");
    });

    it("throws VALIDATION_ERROR for LIMIT order without price", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "BUY",
          type: "LIMIT",
        }),
      ).rejects.toThrow("Limit orders require a price");
    });

    it("throws VALIDATION_ERROR for negative price", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "BUY",
          type: "LIMIT",
          price: -100,
        }),
      ).rejects.toThrow("Price must be positive");
    });

    it("validates sell orders require cert details or card instance", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
        }),
      ).rejects.toThrow("Sell orders require certNumber, gradingCompany, and grade");
    });

    it("creates a SELL order with cert details (Path A)", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null); // no existing cert
      (prisma.cardInstance.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inst-new",
        cardId: "card-1",
        ownerId: "user-1",
        gradingCompany: "PSA",
        certNumber: "12345678",
        grade: 9.5,
        status: "LISTED",
      });
      (prisma.orderBook.upsert as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrderBook);
      (prisma.order.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        id: "sell-order-1",
        side: "SELL",
        price: 5000,
        cardInstanceId: "inst-new",
        cardInstance: {
          id: "inst-new",
          certNumber: "12345678",
          grade: 9.5,
          gradingCompany: "PSA",
        },
      });

      const result = await placeOrder("user-1", {
        cardId: "card-1",
        side: "SELL",
        type: "LIMIT",
        price: 5000,
        certNumber: "12345678",
        gradingCompany: "PSA",
        grade: 9.5,
      });

      expect(result.side).toBe("SELL");
      expect(prisma.cardInstance.create).toHaveBeenCalled();
      expect(prisma.order.create).toHaveBeenCalled();
    });

    it("rejects duplicate cert numbers", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-inst",
        certNumber: "12345678",
      });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
          certNumber: "12345678",
          gradingCompany: "PSA",
          grade: 9.5,
        }),
      ).rejects.toThrow("Cert number already registered");
    });

    it("rejects invalid grade values", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
          certNumber: "12345678",
          gradingCompany: "PSA",
          grade: 11,
        }),
      ).rejects.toThrow("Grade must be between 1 and 10");
    });

    it("prevents selling unverified card instances", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inst-1",
        ownerId: "user-1",
        cardId: "card-1",
        status: "PENDING_SHIPMENT",
      });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
          cardInstanceId: "inst-1",
        }),
      ).rejects.toThrow("Card instance must be VERIFIED to sell");
    });

    it("prevents selling a card you do not own", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inst-1",
        ownerId: "other-user",
        cardId: "card-1",
        status: "VERIFIED",
      });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
          cardInstanceId: "inst-1",
        }),
      ).rejects.toThrow("You do not own this card instance");
    });

    it("prevents double-listing the same card instance", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "inst-1",
        ownerId: "user-1",
        cardId: "card-1",
        status: "VERIFIED",
      });
      (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-order",
      });

      await expect(
        placeOrder("user-1", {
          cardId: "card-1",
          side: "SELL",
          type: "LIMIT",
          price: 5000,
          cardInstanceId: "inst-1",
        }),
      ).rejects.toThrow("Card instance is already listed");
    });

    it("returns existing order for duplicate idempotency key", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrder);

      const result = await placeOrder("user-1", {
        cardId: "card-1",
        side: "BUY",
        type: "LIMIT",
        price: 5000,
        idempotencyKey: "idem-1",
      });

      expect(result.id).toBe("order-1");
      expect(prisma.order.create).not.toHaveBeenCalled();
    });
  });

  describe("cancelOrder", () => {
    it("cancels an open buy order", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        userId: "user-1",
        side: "BUY",
        status: "OPEN",
        cardInstanceId: null,
        cardInstance: null,
      });
      (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: "CANCELLED",
      });

      const result = await cancelOrder("user-1", "order-1");
      expect(result.status).toBe("CANCELLED");
    });

    it("cancels a Path A sell order and deletes the card instance", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        userId: "user-1",
        side: "SELL",
        status: "OPEN",
        cardInstanceId: "inst-1",
        cardInstance: { id: "inst-1", status: "LISTED", verifiedAt: null },
      });
      (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: "CANCELLED",
      });

      await cancelOrder("user-1", "order-1");
      expect(prisma.cardInstance.delete).toHaveBeenCalledWith({
        where: { id: "inst-1" },
      });
    });

    it("cancels a Path B sell order and reverts card instance to VERIFIED", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        userId: "user-1",
        side: "SELL",
        status: "OPEN",
        cardInstanceId: "inst-1",
        cardInstance: { id: "inst-1", status: "LISTED", verifiedAt: new Date() },
      });
      (prisma.order.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        status: "CANCELLED",
      });

      await cancelOrder("user-1", "order-1");
      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "inst-1" },
        data: { status: "VERIFIED" },
      });
    });

    it("throws NOT_FOUND for missing order", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(cancelOrder("user-1", "nonexistent")).rejects.toThrow(
        "Order not found",
      );
    });

    it("throws FORBIDDEN when user does not own the order", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        userId: "other-user",
      });

      await expect(cancelOrder("user-1", "order-1")).rejects.toThrow(
        "You do not own this order",
      );
    });

    it("throws VALIDATION_ERROR when order is already filled", async () => {
      (prisma.order.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockOrder,
        userId: "user-1",
        status: "FILLED",
      });

      await expect(cancelOrder("user-1", "order-1")).rejects.toThrow(
        "Cannot cancel order with status: FILLED",
      );
    });
  });

  describe("getOrderBook", () => {
    it("returns empty order book when no orders exist", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.orderBook.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await getOrderBook("card-1");
      expect(result.cardId).toBe("card-1");
      expect(result.bids).toEqual([]);
      expect(result.asks).toEqual([]);
      expect(result.spread).toBeNull();
    });

    it("throws NOT_FOUND for missing card", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getOrderBook("nonexistent")).rejects.toThrow("Card not found");
    });

    it("returns aggregated bids and asks with spread", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.orderBook.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrderBook);
      (prisma.order.groupBy as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce([
          { price: 4900, _sum: { quantity: 3, filledQuantity: 0 }, _count: 2 },
          { price: 4800, _sum: { quantity: 1, filledQuantity: 0 }, _count: 1 },
        ])
        .mockResolvedValueOnce([
          { price: 5100, _sum: { quantity: 2, filledQuantity: 0 }, _count: 1 },
          { price: 5200, _sum: { quantity: 1, filledQuantity: 0 }, _count: 1 },
        ]);
      (prisma.trade.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        price: 5000,
        createdAt: new Date("2024-01-01"),
      });

      const result = await getOrderBook("card-1");
      expect(result.bids).toHaveLength(2);
      expect(result.asks).toHaveLength(2);
      expect(result.bids[0].price).toBe(4900);
      expect(result.asks[0].price).toBe(5100);
      expect(result.spread).toBe(200); // 5100 - 4900
      expect(result.lastTradePrice).toBe(5000);
    });
  });

  describe("getUserOrders", () => {
    it("returns paginated user orders", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [mockOrder],
        1,
      ]);

      const result = await getUserOrders("user-1", {});
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it("caps limit at 100", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([[], 0]);

      const result = await getUserOrders("user-1", { limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });
  });
});
