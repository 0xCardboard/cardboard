import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import {
  createNotification,
  getUserNotifications,
  markRead,
  markAllRead,
} from "@/services/notification.service";

describe("notification.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createNotification", () => {
    it("creates a notification", async () => {
      (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "notif-1",
      });

      await createNotification("user-1", "TRADE_FILLED", "Test", "Test message", {
        tradeId: "trade-1",
      });

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "TRADE_FILLED",
          title: "Test",
          message: "Test message",
          data: { tradeId: "trade-1" },
        },
      });
    });

    it("handles null data", async () => {
      (prisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "notif-1",
      });

      await createNotification("user-1", "SYSTEM", "Title", "Message");

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ data: expect.anything() }),
      });
    });
  });

  describe("getUserNotifications", () => {
    it("returns paginated notifications with unread count", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([
        [{ id: "n1", type: "TRADE_FILLED", readAt: null }],
        1,
        1,
      ]);

      const result = await getUserNotifications("user-1");
      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.unreadCount).toBe(1);
    });

    it("caps limit at 100", async () => {
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([[], 0, 0]);

      const result = await getUserNotifications("user-1", { limit: 500 });
      expect(result.pagination.limit).toBe(100);
    });
  });

  describe("markRead", () => {
    it("marks a notification as read", async () => {
      (prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "n1",
        userId: "user-1",
        readAt: null,
      });
      (prisma.notification.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await markRead("user-1", "n1");

      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { readAt: expect.any(Date) },
      });
    });

    it("throws NOT_FOUND for missing notification", async () => {
      (prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(markRead("user-1", "nonexistent")).rejects.toThrow("Notification not found");
    });

    it("throws FORBIDDEN for wrong user", async () => {
      (prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "n1",
        userId: "other-user",
        readAt: null,
      });

      await expect(markRead("user-1", "n1")).rejects.toThrow("Not your notification");
    });

    it("skips if already read", async () => {
      (prisma.notification.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "n1",
        userId: "user-1",
        readAt: new Date(),
      });

      await markRead("user-1", "n1");
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });
  });

  describe("markAllRead", () => {
    it("marks all as read and returns count", async () => {
      (prisma.notification.updateMany as ReturnType<typeof vi.fn>).mockResolvedValue({
        count: 5,
      });

      const count = await markAllRead("user-1");
      expect(count).toBe(5);
    });
  });
});
