import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  createInboundShipment,
  createRedemptionShipment,
  updateShipmentStatus,
} from "@/services/shipment.service";

// Mock notification service
vi.mock("@/services/notification.service", () => ({
  createNotification: vi.fn(),
}));

describe("shipment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createInboundShipment", () => {
    it("creates inbound shipment and updates card instance to IN_TRANSIT", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        sellerId: "seller-1",
      });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        status: "PENDING_SHIPMENT",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.shipment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ship-1",
      });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await createInboundShipment(
        "seller-1",
        "trade-1",
        "ci-1",
        "TRACK123",
        "USPS",
      );

      expect(result.id).toBe("ship-1");
      expect(prisma.shipment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          direction: "INBOUND",
          status: "SHIPPED",
          trackingNumber: "TRACK123",
          carrier: "USPS",
        }),
      });
      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: { status: "IN_TRANSIT" },
      });
    });

    it("rejects non-seller", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        sellerId: "other-user",
      });

      await expect(
        createInboundShipment("user-1", "trade-1", "ci-1", "TRACK123", "USPS"),
      ).rejects.toThrow("Only the seller");
    });

    it("rejects duplicate inbound shipment", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        sellerId: "seller-1",
      });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        status: "PENDING_SHIPMENT",
      });
      (prisma.shipment.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "existing-ship",
      });

      await expect(
        createInboundShipment("seller-1", "trade-1", "ci-1", "TRACK123", "USPS"),
      ).rejects.toThrow("already exists");
    });
  });

  describe("updateShipmentStatus", () => {
    it("moves card to PENDING_VERIFICATION when inbound is delivered", async () => {
      (prisma.shipment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ship-1",
        direction: "INBOUND",
        cardInstanceId: "ci-1",
        tradeId: "trade-1",
        trade: { sellerId: "seller-1" },
      });
      (prisma.shipment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await updateShipmentStatus("admin-1", "ship-1", "DELIVERED");

      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: { status: "PENDING_VERIFICATION" },
      });
    });

    it("transfers ownership when outbound is delivered", async () => {
      (prisma.shipment.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ship-2",
        direction: "OUTBOUND",
        cardInstanceId: "ci-1",
        tradeId: "trade-1",
        trade: { buyerId: "buyer-1" },
      });
      (prisma.shipment.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await updateShipmentStatus("admin-1", "ship-2", "DELIVERED");

      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: { ownerId: "buyer-1", status: "VERIFIED" },
      });
    });
  });

  describe("createRedemptionShipment", () => {
    it("creates redemption shipment", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        ownerId: "user-1",
        status: "VERIFIED",
        certNumber: "CERT123",
      });
      (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.loan.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.shipment.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ship-3",
      });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const result = await createRedemptionShipment("user-1", "ci-1");
      expect(result.id).toBe("ship-3");
      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: { status: "REDEEMED" },
      });
    });

    it("rejects if card is in open order", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        ownerId: "user-1",
        status: "VERIFIED",
      });
      (prisma.order.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "order-1",
      });

      await expect(createRedemptionShipment("user-1", "ci-1")).rejects.toThrow(
        "currently listed",
      );
    });

    it("rejects non-owner", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        ownerId: "other-user",
        status: "VERIFIED",
      });

      await expect(createRedemptionShipment("user-1", "ci-1")).rejects.toThrow(
        "do not own",
      );
    });
  });
});
