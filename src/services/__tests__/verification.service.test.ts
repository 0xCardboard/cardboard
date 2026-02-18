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
vi.mock("@/services/psa-scan.service", () => ({
  getPsaScanUrl: vi.fn().mockReturnValue("https://psacard.com/cert/CERT123/psa"),
  getPsaScanImageUrls: vi.fn().mockResolvedValue({ front: null, back: null }),
}));

const mockCard = { name: "Charizard" };

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
    it("marks card as VERIFIED, transfers ownership to buyer, and releases escrow on pass", async () => {
      const baseMock = {
        id: "ci-1",
        ownerId: "seller-1",
        certNumber: "CERT123",
        gradingCompany: "PSA",
        status: "PENDING_VERIFICATION",
        card: mockCard,
        orders: [
          {
            sellTrades: [{ id: "trade-1", buyerId: "buyer-1", sellerId: "seller-1" }],
          },
        ],
      };
      // First findUnique (claimCard check) — unclaimed
      // Second findUnique (claimCard inner) — same
      // Third findUnique (completeVerification) — now claimed by admin
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })       // verifyCard wrapper check
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })       // claimCard validation
        .mockResolvedValueOnce({ ...baseMock, claimedById: "admin-1" }); // completeVerification
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await verifyCard("admin-1", "ci-1", true, "Looks good");

      const verifyCall = (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === "VERIFIED",
      );
      expect(verifyCall).toBeDefined();
      expect(verifyCall![0]).toEqual({
        where: { id: "ci-1" },
        data: expect.objectContaining({
          status: "VERIFIED",
          verifiedAt: expect.any(Date),
          verifiedById: "admin-1",
          ownerId: "buyer-1",
        }),
      });

      const { releaseEscrow } = await import("@/services/escrow.service");
      expect(releaseEscrow).toHaveBeenCalledWith("trade-1");
    });

    it("does not transfer ownership when there is no trade (vault deposit)", async () => {
      const baseMock = {
        id: "ci-2",
        ownerId: "owner-1",
        certNumber: "CERT456",
        gradingCompany: "PSA",
        status: "PENDING_VERIFICATION",
        card: mockCard,
        orders: [],
      };
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })
        .mockResolvedValueOnce({ ...baseMock, claimedById: "admin-1" });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await verifyCard("admin-1", "ci-2", true);

      const verifyCall = (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === "VERIFIED",
      );
      expect(verifyCall).toBeDefined();
      expect(verifyCall![0].data).not.toHaveProperty("ownerId");
    });

    it("refunds buyer and reverts card on failure", async () => {
      const baseMock = {
        id: "ci-1",
        ownerId: "seller-1",
        certNumber: "CERT123",
        gradingCompany: "PSA",
        status: "PENDING_VERIFICATION",
        card: mockCard,
        orders: [
          {
            sellTrades: [{ id: "trade-1", buyerId: "buyer-1", sellerId: "seller-1" }],
          },
        ],
      };
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })
        .mockResolvedValueOnce({ ...baseMock, claimedById: null })
        .mockResolvedValueOnce({ ...baseMock, claimedById: "admin-1" });
      (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await verifyCard("admin-1", "ci-1", false, "Counterfeit");

      const rejectCall = (prisma.cardInstance.update as ReturnType<typeof vi.fn>).mock.calls.find(
        (call: unknown[]) =>
          (call[0] as { data: { status?: string } }).data.status === "PENDING_SHIPMENT",
      );
      expect(rejectCall).toBeDefined();

      const { cancelEscrow } = await import("@/services/escrow.service");
      expect(cancelEscrow).toHaveBeenCalledWith("trade-1", "Counterfeit");
    });

    it("rejects non-PENDING_VERIFICATION cards", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "ci-1",
        status: "VERIFIED",
        claimedById: null,
        orders: [],
      });

      await expect(verifyCard("admin-1", "ci-1", true)).rejects.toThrow(
        "expected PENDING_VERIFICATION",
      );
    });
  });
});
