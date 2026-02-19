import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { publish } from "@/lib/publish";
import { sendNotificationEmail } from "@/services/email.service";
import type { NotificationType } from "@/generated/prisma/client";

interface NotificationFilters {
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
}

interface PaginatedNotifications {
  data: {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  unreadCount: number;
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>,
): Promise<void> {
  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      data: data ? (data as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  // Push real-time notification via WebSocket
  try {
    publish(`notifications:${userId}`, {
      id: notification.id,
      type,
      title,
      message,
      data,
      createdAt: notification.createdAt,
    });
  } catch {
    // WebSocket server may not be running — silently ignore
  }

  // Send transactional email (async, non-blocking)
  sendNotificationEmail(userId, type, title, message).catch(() => {});
}

export async function getUserNotifications(
  userId: string,
  filters: NotificationFilters = {},
): Promise<PaginatedNotifications> {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId };
  if (filters.unreadOnly) {
    where.readAt = null;
  }

  const [data, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    unreadCount,
  };
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new AppError("NOT_FOUND", "Notification not found");
  }

  if (notification.userId !== userId) {
    throw new AppError("FORBIDDEN", "Not your notification");
  }

  if (notification.readAt) return;

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  return result.count;
}
