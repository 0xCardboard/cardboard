import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createNotification } from "@/services/notification.service";
import type { ShipmentStatus } from "@/generated/prisma/client";

interface ShipmentFilters {
  direction?: "INBOUND" | "OUTBOUND";
  status?: ShipmentStatus;
  page?: number;
  limit?: number;
}

const SHIPMENT_INCLUDE = {
  cardInstance: {
    select: {
      id: true,
      certNumber: true,
      grade: true,
      gradingCompany: true,
      card: { select: { id: true, name: true, imageUrl: true } },
    },
  },
  user: { select: { id: true, name: true, email: true } },
  trade: { select: { id: true, buyerId: true, sellerId: true, price: true } },
} as const;

/**
 * Seller submits inbound tracking info after a trade match.
 */
export async function createInboundShipment(
  userId: string,
  tradeId: string,
  cardInstanceId: string,
  trackingNumber: string,
  carrier: string,
): Promise<{ id: string }> {
  // Validate trade exists and user is the seller
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");
  if (trade.sellerId !== userId) throw new AppError("FORBIDDEN", "Only the seller can submit inbound shipment");

  // Validate card instance
  const instance = await prisma.cardInstance.findUnique({ where: { id: cardInstanceId } });
  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.status !== "PENDING_SHIPMENT") {
    throw new AppError("VALIDATION_ERROR", `Card instance status is ${instance.status}, expected PENDING_SHIPMENT`);
  }

  // Check no existing inbound shipment for this trade
  const existing = await prisma.shipment.findFirst({
    where: { tradeId, direction: "INBOUND" },
  });
  if (existing) {
    throw new AppError("CONFLICT", "Inbound shipment already exists for this trade");
  }

  const shipment = await prisma.shipment.create({
    data: {
      cardInstanceId,
      userId,
      tradeId,
      direction: "INBOUND",
      trackingNumber,
      carrier,
      status: "SHIPPED",
    },
  });

  // Update card instance to IN_TRANSIT
  await prisma.cardInstance.update({
    where: { id: cardInstanceId },
    data: { status: "IN_TRANSIT" },
  });

  // Notify admins about incoming shipment
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "SHIPMENT_UPDATE",
      "Inbound Shipment",
      `Seller shipped card for trade ${tradeId}. Tracking: ${trackingNumber}`,
      { shipmentId: shipment.id, tradeId, trackingNumber, carrier },
    );
  }

  return { id: shipment.id };
}

/**
 * Admin creates outbound shipment to buyer after verification.
 */
export async function createOutboundShipment(
  adminId: string,
  tradeId: string,
  cardInstanceId: string,
  trackingNumber: string,
  carrier: string,
): Promise<{ id: string }> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");

  const instance = await prisma.cardInstance.findUnique({ where: { id: cardInstanceId } });
  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");

  const shipment = await prisma.shipment.create({
    data: {
      cardInstanceId,
      userId: adminId,
      tradeId,
      direction: "OUTBOUND",
      trackingNumber,
      carrier,
      status: "SHIPPED",
    },
  });

  // Notify buyer
  await createNotification(
    trade.buyerId,
    "SHIPMENT_UPDATE",
    "Card Shipped",
    `Your card has been shipped! Tracking: ${trackingNumber} (${carrier})`,
    { shipmentId: shipment.id, tradeId, trackingNumber, carrier },
  );

  return { id: shipment.id };
}

/**
 * Admin updates shipment status. Triggers state transitions.
 */
export async function updateShipmentStatus(
  adminId: string,
  shipmentId: string,
  newStatus: ShipmentStatus,
  notes?: string,
): Promise<void> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { trade: true },
  });

  if (!shipment) throw new AppError("NOT_FOUND", "Shipment not found");

  const updateData: { status: ShipmentStatus; notes?: string; deliveredAt?: Date } = {
    status: newStatus,
  };
  if (notes) updateData.notes = notes;
  if (newStatus === "DELIVERED") updateData.deliveredAt = new Date();

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: updateData,
  });

  // State transitions based on direction + new status
  if (shipment.direction === "INBOUND" && newStatus === "DELIVERED") {
    // Company received the card → move to verification queue
    await prisma.cardInstance.update({
      where: { id: shipment.cardInstanceId },
      data: { status: "PENDING_VERIFICATION" },
    });

    if (shipment.trade) {
      await createNotification(
        shipment.trade.sellerId,
        "SHIPMENT_UPDATE",
        "Card Received",
        "Your card has been received and is pending verification.",
        { shipmentId, tradeId: shipment.tradeId },
      );
    }
  }

  if (shipment.direction === "OUTBOUND" && newStatus === "DELIVERED") {
    // Buyer received the card → transfer ownership
    if (shipment.trade) {
      await prisma.cardInstance.update({
        where: { id: shipment.cardInstanceId },
        data: {
          ownerId: shipment.trade.buyerId,
          status: "VERIFIED", // Available for relisting
        },
      });

      await createNotification(
        shipment.trade.buyerId,
        "SHIPMENT_UPDATE",
        "Card Delivered",
        "Your card has been delivered! It's now in your portfolio.",
        { shipmentId, tradeId: shipment.tradeId },
      );
    }
  }
}

/**
 * User redeems an IOU — requests physical card delivery.
 */
export async function createRedemptionShipment(
  userId: string,
  cardInstanceId: string,
): Promise<{ id: string }> {
  const instance = await prisma.cardInstance.findUnique({ where: { id: cardInstanceId } });
  if (!instance) throw new AppError("NOT_FOUND", "Card instance not found");
  if (instance.ownerId !== userId) throw new AppError("FORBIDDEN", "You do not own this card");
  if (instance.status !== "VERIFIED") {
    throw new AppError("VALIDATION_ERROR", `Card must be VERIFIED to redeem, current status: ${instance.status}`);
  }

  // Check not listed in any open order
  const openOrder = await prisma.order.findFirst({
    where: { cardInstanceId, status: { in: ["OPEN", "PARTIALLY_FILLED"] } },
  });
  if (openOrder) {
    throw new AppError("CONFLICT", "Card is currently listed in an open order. Cancel the order first.");
  }

  // Check not locked as loan collateral
  const activeLoan = await prisma.loan.findFirst({
    where: { cardInstanceId, status: { in: ["REQUESTING", "FUNDED", "ACTIVE"] } },
  });
  if (activeLoan) {
    throw new AppError("CONFLICT", "Card is locked as loan collateral");
  }

  const shipment = await prisma.shipment.create({
    data: {
      cardInstanceId,
      userId,
      direction: "OUTBOUND",
      status: "LABEL_CREATED",
    },
  });

  await prisma.cardInstance.update({
    where: { id: cardInstanceId },
    data: { status: "REDEEMED" },
  });

  // Notify admins to prepare outbound shipment
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  for (const admin of admins) {
    await createNotification(
      admin.id,
      "SHIPMENT_UPDATE",
      "Redemption Request",
      `User requested redemption of card ${instance.certNumber}.`,
      { shipmentId: shipment.id, cardInstanceId },
    );
  }

  return { id: shipment.id };
}

/**
 * Get shipments for a specific trade.
 */
export async function getShipmentsByTrade(tradeId: string) {
  return prisma.shipment.findMany({
    where: { tradeId },
    include: SHIPMENT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Get a user's shipments (as sender or as recipient via trade).
 */
export async function getUserShipments(userId: string, filters: ShipmentFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    OR: [
      { userId },
      { trade: { buyerId: userId } },
      { trade: { sellerId: userId } },
    ],
  };

  if (filters.direction) where.direction = filters.direction;
  if (filters.status) where.status = filters.status;

  const [data, total] = await prisma.$transaction([
    prisma.shipment.findMany({
      where,
      include: SHIPMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Admin shipment queue — all shipments with filters.
 */
export async function getAdminShipmentQueue(filters: ShipmentFilters = {}) {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (filters.direction) where.direction = filters.direction;
  if (filters.status) where.status = filters.status;

  const [data, total] = await prisma.$transaction([
    prisma.shipment.findMany({
      where,
      include: SHIPMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.shipment.count({ where }),
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Get a shipment by ID.
 */
export async function getShipmentById(shipmentId: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: SHIPMENT_INCLUDE,
  });

  if (!shipment) throw new AppError("NOT_FOUND", "Shipment not found");
  return shipment;
}
