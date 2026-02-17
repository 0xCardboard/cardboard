import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { openDispute, resolveDispute, getAdminDisputeQueue } from "@/services/dispute.service";

// Mock dependent services
vi.mock("@/services/escrow.service", () => ({
  cancelEscrow: vi.fn(),
}));
vi.mock("@/services/notification.service", () => ({
  createNotification: vi.fn(),
}));

describe("dispute.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("openDispute", () => {
    it("creates a dispute for a valid trade", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        escrowStatus: "CAPTURED",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dispute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dispute.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "dispute-1",
      });
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (prisma.reputation.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await openDispute(
        "buyer-1",
        "trade-1",
        "SHIPPING_DAMAGE",
        "Card arrived damaged in transit",
      );

      expect(result.id).toBe("dispute-1");
      expect(prisma.dispute.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tradeId: "trade-1",
          userId: "buyer-1",
          reason: "SHIPPING_DAMAGE",
          status: "OPEN",
        }),
      });
    });

    it("rejects non-buyer", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "other-buyer",
        escrowStatus: "CAPTURED",
      });

      await expect(
        openDispute("user-1", "trade-1", "SHIPPING_DAMAGE", "Card arrived damaged"),
      ).rejects.toThrow("Only the buyer");
    });

    it("rejects short description", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        escrowStatus: "CAPTURED",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dispute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        openDispute("buyer-1", "trade-1", "OTHER", "short"),
      ).rejects.toThrow("at least 10 characters");
    });

    it("rejects duplicate dispute", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        escrowStatus: "CAPTURED",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.dispute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing",
      });

      await expect(
        openDispute("buyer-1", "trade-1", "WRONG_CARD", "This is a detailed description"),
      ).rejects.toThrow("already have a dispute");
    });

    it("rejects dispute outside window", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        escrowStatus: "RELEASED",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        deliveredAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      });

      await expect(
        openDispute("buyer-1", "trade-1", "SHIPPING_DAMAGE", "Card arrived damaged a while ago"),
      ).rejects.toThrow("window has closed");
    });
  });

  describe("resolveDispute", () => {
    it("resolves with refund", async () => {
      (prisma.dispute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "dispute-1",
        tradeId: "trade-1",
        userId: "buyer-1",
        status: "OPEN",
        trade: { id: "trade-1" },
      });
      (prisma.dispute.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await resolveDispute("admin-1", "dispute-1", "RESOLVED_REFUND", "Confirmed damage");

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: "dispute-1" },
        data: expect.objectContaining({
          status: "RESOLVED_REFUND",
          resolvedById: "admin-1",
        }),
      });

      const { cancelEscrow } = await import("@/services/escrow.service");
      expect(cancelEscrow).toHaveBeenCalledWith("trade-1", "Dispute resolved: Confirmed damage", undefined);
    });

    it("rejects already resolved dispute", async () => {
      (prisma.dispute.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "dispute-1",
        status: "RESOLVED_REFUND",
      });

      await expect(
        resolveDispute("admin-1", "dispute-1", "RESOLVED_REJECTED", "Already resolved"),
      ).rejects.toThrow("Cannot resolve dispute");
    });
  });

  describe("getAdminDisputeQueue", () => {
    it("returns paginated disputes", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ id: "d1", reason: "SHIPPING_DAMAGE", status: "OPEN" }],
        1,
      ]);

      const result = await getAdminDisputeQueue();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });
});
