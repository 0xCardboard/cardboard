import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cancelEscrow } from "@/services/escrow.service";
import { createNotification } from "@/services/notification.service";
import type { DisputeStatus } from "@/generated/prisma/client";

const DISPUTE_WINDOW_DAYS = 14;

interface DisputeFilters {
  status?: DisputeStatus;
  page?: number;
  limit?: number;
}

/**
 * Buyer opens a dispute for a trade.
 * Only available within 14 days of outbound delivery.
 */
export async function openDispute(
  userId: string,
  tradeId: string,
  reason: "SHIPPING_DAMAGE" | "WRONG_CARD" | "GRADE_DISCREPANCY" | "NON_DELIVERY" | "OTHER",
  description: string,
  evidence: string[] = [],
): Promise<{ id: string }> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");

  // Only the buyer can file a dispute
  if (trade.buyerId !== userId) {
    throw new AppError("FORBIDDEN", "Only the buyer can open a dispute");
  }

  // Trade must have been paid (CAPTURED or RELEASED)
  if (trade.escrowStatus !== "CAPTURED" && trade.escrowStatus !== "RELEASED") {
    throw new AppError("VALIDATION_ERROR", `Cannot dispute a trade with escrow status: ${trade.escrowStatus}`);
  }

  // Check dispute window: within 14 days of outbound delivery
  const outboundShipment = await prisma.shipment.findFirst({
    where: { tradeId, direction: "OUTBOUND", status: "DELIVERED" },
  });

  if (outboundShipment?.deliveredAt) {
    const daysSinceDelivery = (Date.now() - outboundShipment.deliveredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDelivery > DISPUTE_WINDOW_DAYS) {
      throw new AppError("VALIDATION_ERROR", `Dispute window has closed (${DISPUTE_WINDOW_DAYS} days after delivery)`);
    }
  }

  // Check no existing open dispute
  const existing = await prisma.dispute.findUnique({
    where: { tradeId_userId: { tradeId, userId } },
  });
  if (existing) {
    throw new AppError("CONFLICT", "You already have a dispute for this trade");
  }

  if (!description || description.trim().length < 10) {
    throw new AppError("VALIDATION_ERROR", "Description must be at least 10 characters");
  }

  const dispute = await prisma.dispute.create({
    data: {
      tradeId,
      userId,
      reason,
      description: description.trim(),
      evidence,
      status: "OPEN",
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "DISPUTE_OPENED",
      "New Dispute",
      `Dispute filed for trade ${tradeId}: ${reason}`,
      { disputeId: dispute.id, tradeId, reason },
    );
  }

  // Notify the seller (counterparty)
  await createNotification(
    trade.sellerId,
    "DISPUTE_OPENED",
    "Dispute Filed Against Your Trade",
    `A buyer has filed a dispute for trade ${tradeId}. Reason: ${reason}. Our team will review and reach out if needed.`,
    { disputeId: dispute.id, tradeId, reason },
  );

  // Update buyer's reputation dispute count
  await prisma.reputation.updateMany({
    where: { userId },
    data: { disputeCount: { increment: 1 } },
  });

  return { id: dispute.id };
}

/**
 * Admin resolves a dispute.
 */
export async function resolveDispute(
  adminId: string,
  disputeId: string,
  resolution: "RESOLVED_REFUND" | "RESOLVED_REPLACEMENT" | "RESOLVED_REJECTED",
  adminNotes: string,
  refundAmount?: number,
): Promise<void> {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: { trade: true },
  });

  if (!dispute) throw new AppError("NOT_FOUND", "Dispute not found");
  if (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW") {
    throw new AppError("VALIDATION_ERROR", `Cannot resolve dispute with status: ${dispute.status}`);
  }

  await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: resolution,
      adminNotes,
      resolvedById: adminId,
      resolvedAt: new Date(),
      refundAmount: refundAmount ?? null,
    },
  });

  if (resolution === "RESOLVED_REFUND") {
    // Refund the buyer (full or partial)
    await cancelEscrow(
      dispute.tradeId,
      `Dispute resolved: ${adminNotes}`,
      refundAmount,
    );

    await createNotification(
      dispute.userId,
      "DISPUTE_RESOLVED",
      "Dispute Resolved — Refund Issued",
      `Your dispute has been resolved in your favor. A refund has been issued.${adminNotes ? ` Details: ${adminNotes}` : ""}`,
      { disputeId, resolution, refundAmount },
    );

    // Notify seller about the dispute resolution
    if (dispute.trade) {
      await createNotification(
        dispute.trade.sellerId,
        "DISPUTE_RESOLVED",
        "Dispute Resolved — Buyer Refunded",
        `A dispute for trade ${dispute.tradeId} has been resolved with a refund to the buyer.${adminNotes ? ` Details: ${adminNotes}` : ""}`,
        { disputeId, resolution },
      );
    }
  }

  if (resolution === "RESOLVED_REPLACEMENT") {
    // Admin will handle replacement shipment separately
    await createNotification(
      dispute.userId,
      "DISPUTE_RESOLVED",
      "Dispute Resolved — Replacement",
      `Your dispute has been resolved. A replacement card will be shipped to you.`,
      { disputeId, resolution },
    );

    // Notify seller
    if (dispute.trade) {
      await createNotification(
        dispute.trade.sellerId,
        "DISPUTE_RESOLVED",
        "Dispute Resolved — Replacement Required",
        `A dispute for trade ${dispute.tradeId} has been resolved. A replacement card will be sent to the buyer.${adminNotes ? ` Details: ${adminNotes}` : ""}`,
        { disputeId, resolution },
      );
    }
  }

  if (resolution === "RESOLVED_REJECTED") {
    await createNotification(
      dispute.userId,
      "DISPUTE_RESOLVED",
      "Dispute Rejected",
      `Your dispute has been reviewed and rejected.${adminNotes ? ` Reason: ${adminNotes}` : ""}`,
      { disputeId, resolution },
    );

    // Notify seller that the dispute was rejected (in their favor)
    if (dispute.trade) {
      await createNotification(
        dispute.trade.sellerId,
        "DISPUTE_RESOLVED",
        "Dispute Dismissed",
        `A dispute filed against trade ${dispute.tradeId} has been reviewed and dismissed.`,
        { disputeId, resolution },
      );
    }
  }
}

/**
 * Get user's disputes.
 */
export async function getUserDisputes(userId: string, filters: DisputeFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = { userId };
  if (filters.status) where.status = filters.status;

  const [data, total] = await prisma.$transaction([
    prisma.dispute.findMany({
      where,
      include: {
        trade: { select: { id: true, price: true, quantity: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Admin dispute queue.
 */
export async function getAdminDisputeQueue(filters: DisputeFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (filters.status) where.status = filters.status;

  const [data, total] = await prisma.$transaction([
    prisma.dispute.findMany({
      where,
      include: {
        trade: { select: { id: true, price: true, quantity: true } },
        user: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.dispute.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get dispute by ID.
 */
export async function getDisputeById(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      trade: {
        select: {
          id: true,
          price: true,
          quantity: true,
          buyerId: true,
          sellerId: true,
          escrowStatus: true,
          createdAt: true,
        },
      },
      user: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true } },
    },
  });

  if (!dispute) throw new AppError("NOT_FOUND", "Dispute not found");
  return dispute;
}
