import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { verifyCard, getVerificationQueue } from "@/services/verification.service";

// Mock dependent services
vi.mock("@/services/escrow.service", () => ({
  releaseEscrow: vi.fn(),
  cancelEscrow: vi.fn(),
}));
vi.mock("@/services/notification.service", () => ({
  createNotification: vi.fn(),
}));

describe("verification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVerificationQueue", () => {
    it("returns paginated results", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ id: "ci-1", certNumber: "CERT123", grade: 9.5 }],
        1,
      ]);

      const result = await getVerificationQueue();
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe("verifyCard", () => {
    it("marks card as VERIFIED and releases escrow on pass", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        ownerId: "seller-1",
        certNumber: "CERT123",
        status: "PENDING_VERIFICATION",
        orders: [
          {
            sellTrades: [{ id: "trade-1", buyerId: "buyer-1", sellerId: "seller-1" }],
          },
        ],
      });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await verifyCard("admin-1", "ci-1", true, "Looks good");

      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: expect.objectContaining({
          status: "VERIFIED",
          verifiedAt: expect.any(Date),
          verifiedById: "admin-1",
        }),
      });

      const { releaseEscrow } = await import("@/services/escrow.service");
      expect(releaseEscrow).toHaveBeenCalledWith("trade-1");
    });

    it("refunds buyer and reverts card on failure", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        ownerId: "seller-1",
        certNumber: "CERT123",
        status: "PENDING_VERIFICATION",
        orders: [
          {
            sellTrades: [{ id: "trade-1", buyerId: "buyer-1", sellerId: "seller-1" }],
          },
        ],
      });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await verifyCard("admin-1", "ci-1", false, "Counterfeit");

      expect(prisma.cardInstance.update).toHaveBeenCalledWith({
        where: { id: "ci-1" },
        data: { status: "PENDING_SHIPMENT" },
      });

      const { cancelEscrow } = await import("@/services/escrow.service");
      expect(cancelEscrow).toHaveBeenCalledWith("trade-1", "Counterfeit");
    });

    it("rejects non-PENDING_VERIFICATION cards", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        status: "VERIFIED",
        orders: [],
      });

      await expect(verifyCard("admin-1", "ci-1", true)).rejects.toThrow(
        "expected PENDING_VERIFICATION",
      );
    });
  });
});
