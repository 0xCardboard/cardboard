import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "./queue";
import { prisma } from "@/lib/db";
import { cancelEscrow } from "@/services/escrow.service";
import { createNotification } from "@/services/notification.service";

function getRedisConnection() {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
  };
}

interface ShipDeadlineJobData {
  tradeId: string;
}

const worker = new Worker(
  QUEUE_NAMES.SHIP_DEADLINE,
  async (job: Job<ShipDeadlineJobData>) => {
    if (job.name === "ship-deadline-warning") {
      console.log(`[ship-deadline] Warning check for trade ${job.data.tradeId}`);
      await sendShipDeadlineWarning(job.data.tradeId);
    } else {
      console.log(`[ship-deadline] Deadline check for trade ${job.data.tradeId}`);
      await checkShipDeadline(job.data.tradeId);
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 5,
  },
);

/**
 * Send a reminder to the seller 24h before the ship deadline.
 * Only fires if the seller hasn't shipped yet.
 */
async function sendShipDeadlineWarning(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
  });

  if (!trade) return;
  if (trade.escrowStatus !== "CAPTURED") return;

  // Check if seller already shipped
  const shipment = await prisma.shipment.findFirst({
    where: { tradeId, direction: "INBOUND" },
  });

  if (shipment) return; // Already shipped — no warning needed

  const deadlineStr = trade.shipDeadline
    ? trade.shipDeadline.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
    : "soon";

  await createNotification(
    trade.sellerId,
    "SHIPMENT_UPDATE",
    "Reminder: Ship Your Card by Tomorrow",
    `Your shipping deadline is ${deadlineStr}. Ship your card to the warehouse to avoid trade cancellation.\n\nCardboard Warehouse\nAttn: Card Verification\n123 Trading Card Lane, Suite 100\nAustin, TX 78701\n\nView full packing guidelines at /shipping-instructions`,
    { tradeId, shipDeadline: trade.shipDeadline?.toISOString() },
  );

  console.log(`[ship-deadline] Warning sent for trade ${tradeId}`);
}

/**
 * Check whether the seller has shipped. If no inbound shipment exists
 * and the trade is still in CAPTURED escrow, auto-cancel and refund.
 */
async function checkShipDeadline(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: {
      sellOrder: { select: { cardInstanceId: true } },
    },
  });

  if (!trade) return;

  // Only act on trades that are still waiting for shipment
  if (trade.escrowStatus !== "CAPTURED") return;

  // Check if an inbound shipment exists for this trade
  const shipment = await prisma.shipment.findFirst({
    where: { tradeId, direction: "INBOUND" },
  });

  if (shipment) {
    // Seller has shipped — no action needed
    return;
  }

  // No shipment found — seller missed the deadline. Cancel and refund.
  await cancelEscrow(tradeId, "Seller did not ship within the 3 business day deadline");

  // Revert the sell order so it can be relisted or cleaned up
  if (trade.sellOrder?.cardInstanceId) {
    await prisma.cardInstance.update({
      where: { id: trade.sellOrder.cardInstanceId },
      data: { status: "LISTED" },
    });
  }

  // Reopen or cancel the sell order
  await prisma.order.update({
    where: { id: trade.sellOrderId },
    data: {
      status: "OPEN",
      filledQuantity: { decrement: trade.quantity },
    },
  });

  // Penalize seller reputation
  await prisma.reputation.upsert({
    where: { userId: trade.sellerId },
    create: {
      userId: trade.sellerId,
      score: -5,
      totalTrades: 1,
      successfulTrades: 0,
    },
    update: {
      score: { decrement: 5 },
      totalTrades: { increment: 1 },
    },
  });

  // Notify seller
  await createNotification(
    trade.sellerId,
    "ORDER_CANCELLED",
    "Trade Cancelled — Ship Deadline Missed",
    "You did not ship your card within 3 business days. The trade has been cancelled and the buyer refunded. Your reputation has been penalized.",
    { tradeId },
  );

  // Notify buyer
  await createNotification(
    trade.buyerId,
    "ORDER_CANCELLED",
    "Trade Cancelled — Seller Did Not Ship",
    "The seller did not ship within the deadline. You have been refunded.",
    { tradeId },
  );

  console.log(`[ship-deadline] Trade ${tradeId} cancelled — seller missed deadline`);
}

worker.on("failed", (job, err) => {
  console.error(`[ship-deadline] Job ${job?.id} failed:`, err.message);
});

worker.on("completed", (job) => {
  console.log(`[ship-deadline] Job ${job.id} completed`);
});

console.log("[ship-deadline] Worker started, waiting for jobs...");
