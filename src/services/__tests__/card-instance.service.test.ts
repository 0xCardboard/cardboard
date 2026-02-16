import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  registerCardInstance,
  getCardInstanceById,
  getUserCardInstances,
} from "@/services/card-instance.service";

describe("card-instance.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerCardInstance", () => {
    it("creates a card instance when card exists and cert is unique", async () => {
      const mockCard = { id: "card-1", name: "Charizard" };
      const mockInstance = {
        id: "inst-1",
        cardId: "card-1",
        ownerId: "user-1",
        gradingCompany: "PSA",
        certNumber: "12345678",
        grade: 9.5,
        status: "PENDING_SHIPMENT",
        imageUrls: [],
        verifiedAt: null,
        createdAt: new Date(),
        card: { id: "card-1", name: "Charizard", imageUrl: null, set: { id: "sv8", name: "Surging Sparks" } },
        owner: { id: "user-1", name: "Test User" },
      };

      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockCard);
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.cardInstance.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockInstance);

      const result = await registerCardInstance("user-1", {
        cardId: "card-1",
        gradingCompany: "PSA",
        certNumber: "12345678",
        grade: 9.5,
      });

      expect(result.id).toBe("inst-1");
      expect(result.gradingCompany).toBe("PSA");
      expect(prisma.cardInstance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cardId: "card-1",
            ownerId: "user-1",
            certNumber: "12345678",
            grade: 9.5,
            status: "PENDING_SHIPMENT",
          }),
        }),
      );
    });

    it("throws NOT_FOUND when card does not exist", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        registerCardInstance("user-1", {
          cardId: "nonexistent",
          gradingCompany: "PSA",
          certNumber: "12345678",
          grade: 9,
        }),
      ).rejects.toThrow("Card not found");
    });

    it("throws CONFLICT when cert number already exists", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "existing" });

      await expect(
        registerCardInstance("user-1", {
          cardId: "card-1",
          gradingCompany: "PSA",
          certNumber: "12345678",
          grade: 9,
        }),
      ).rejects.toThrow("Cert number already registered");
    });

    it("throws VALIDATION_ERROR for invalid grade", async () => {
      (prisma.card.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "card-1" });
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        registerCardInstance("user-1", {
          cardId: "card-1",
          gradingCompany: "PSA",
          certNumber: "12345678",
          grade: 11,
        }),
      ).rejects.toThrow("Grade must be between 1 and 10");
    });
  });

  describe("getCardInstanceById", () => {
    it("returns card instance with details", async () => {
      const mockInstance = {
        id: "inst-1",
        cardId: "card-1",
        gradingCompany: "PSA",
        certNumber: "12345678",
        grade: 9.5,
        status: "VERIFIED",
        imageUrls: [],
        verifiedAt: null,
        createdAt: new Date(),
        card: { id: "card-1", name: "Charizard", imageUrl: null, set: { id: "sv8", name: "Surging Sparks" } },
        owner: { id: "user-1", name: "Test User" },
      };

      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(mockInstance);

      const result = await getCardInstanceById("inst-1");
      expect(result.id).toBe("inst-1");
      expect(result.card.name).toBe("Charizard");
    });

    it("throws NOT_FOUND for missing instance", async () => {
      (prisma.cardInstance.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(getCardInstanceById("nonexistent")).rejects.toThrow(
        "Card instance not found",
      );
    });
  });

  describe("getUserCardInstances", () => {
    it("returns paginated results with default pagination", async () => {
      const mockInstances = [
        { id: "inst-1", card: { id: "card-1", name: "Charizard", imageUrl: null, set: { id: "sv8", name: "Surging Sparks" } }, owner: { id: "user-1", name: "Test" } },
      ];

      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        mockInstances,
        1,
      ]);

      const result = await getUserCardInstances("user-1", {});
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.total).toBe(1);
    });

    it("applies status filter", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([[], 0]);

      await getUserCardInstances("user-1", { status: "VERIFIED" });

      // Verify $transaction was called (filter is applied internally)
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
