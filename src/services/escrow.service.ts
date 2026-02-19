import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { chargeForTrade, payoutToSeller, refundBuyer } from "@/services/payment.service";
import { createNotification } from "@/services/notification.service";
import { paymentProcessingQueue, shipDeadlineQueue } from "@/jobs/queue";

const PAYMENT_RETRY_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculate delay in ms for N business days from now (skips Sat/Sun).
 */
function businessDayDelayMs(days: number): number {
  const now = new Date();
  let remaining = days;
  const target = new Date(now);

  while (remaining > 0) {
    target.setDate(target.getDate() + 1);
    const dayOfWeek = target.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  return target.getTime() - now.getTime();
}

/**
 * Process payment for a trade after order matching.
 * Called inline from the matching engine after the transaction commits.
 * On failure, enqueues a retry job (buyer gets 24h to fix their payment method).
 */
export async function processTradePayment(tradeId: string): Promise<void> {
  try {
    if (process.env.NODE_ENV === "development") {
      // Dev bypass: skip Stripe charge and mark trade as captured
      await prisma.trade.update({
        where: { id: tradeId },
        data: { escrowStatus: "CAPTURED" },
      });
    } else {
      await chargeForTrade(tradeId);
    }

    const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
    if (trade) {
      await createNotification(
        trade.buyerId,
        "TRADE_FILLED",
        "Order Filled",
        `Your buy order was filled at $${(trade.price / 100).toFixed(2)}. Payment captured.`,
        { tradeId },
      );
      await createNotification(
        trade.sellerId,
        "TRADE_FILLED",
        "Order Filled — Ship Your Card",
        `Your sell order was filled at $${(trade.price / 100).toFixed(2)}. Ship your card within 3 business days to:\n\nCardboard Warehouse\nAttn: Card Verification\n123 Trading Card Lane, Suite 100\nAustin, TX 78701\n\nInclude your username and cert number in the package. View full packing guidelines at /shipping-instructions`,
        { tradeId, shippingInstructionsUrl: "/shipping-instructions" },
      );

      // Set ship deadline and enqueue deadline check job
      const deadlineDelay = businessDayDelayMs(3);
      const shipDeadline = new Date(Date.now() + deadlineDelay);

      await prisma.trade.update({
        where: { id: tradeId },
        data: { shipDeadline },
      });

      shipDeadlineQueue
        .add(
          "check-shipment",
          { tradeId },
          {
            delay: deadlineDelay,
            jobId: `ship-deadline-${tradeId}`,
          },
        )
        .catch(() => {
          // Queue unavailable — will need manual monitoring
        });

      // Ship deadline warning: fires 24h before the deadline (at 2 business days)
      const warningDelay = businessDayDelayMs(2);
      if (warningDelay > 0 && warningDelay < deadlineDelay) {
        shipDeadlineQueue
          .add(
            "ship-deadline-warning",
            { tradeId },
            {
              delay: warningDelay,
              jobId: `ship-warning-${tradeId}`,
            },
          )
          .catch(() => {
            // Queue unavailable
          });
      }
    }
  } catch {
    // Payment failed — enqueue retry
    paymentProcessingQueue
      .add(
        "retry-failed-payment",
        { tradeId },
        {
          delay: 60 * 60 * 1000, // First retry after 1 hour
          attempts: 3,
          backoff: { type: "exponential", delay: 4 * 60 * 60 * 1000 }, // 4h, 16h
          jobId: `retry-payment-${tradeId}`,
        },
      )
      .catch(() => {
        // Queue unavailable — will need manual resolution
      });
  }
}

/**
 * Release escrow after admin verifies the card.
 * Transfers funds to seller minus platform fee.
 */
export async function releaseEscrow(tradeId: string): Promise<void> {
  await payoutToSeller(tradeId);

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (trade) {
    await createNotification(
      trade.sellerId,
      "ESCROW_RELEASED",
      "Payment Released",
      `Funds have been transferred to your account for trade ${tradeId}.`,
      { tradeId },
    );
    await createNotification(
      trade.buyerId,
      "CARD_VERIFIED",
      "Card Verified",
      "Your card has been verified. It will be shipped to you shortly.",
      { tradeId },
    );
  }
}

/**
 * Cancel escrow — refund buyer (for failed verification or dispute).
 */
export async function cancelEscrow(
  tradeId: string,
  reason: string,
  refundAmount?: number,
): Promise<void> {
  await refundBuyer(tradeId, reason, refundAmount);

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (trade) {
    await createNotification(
      trade.buyerId,
      "ESCROW_RELEASED",
      "Refund Issued",
      `You have been refunded for trade ${tradeId}. Reason: ${reason}`,
      { tradeId, reason },
    );
    await createNotification(
      trade.sellerId,
      "CARD_VERIFICATION_FAILED",
      "Verification Failed",
      `Card verification failed for trade ${tradeId}. Reason: ${reason}`,
      { tradeId, reason },
    );
  }
}

/**
 * Retry a failed payment for a trade.
 * Called by the BullMQ worker. If past the 24h deadline, auto-cancels the trade.
 */
export async function retryFailedPayment(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { sellOrder: true },
  });

  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");

  if (trade.escrowStatus !== "PAYMENT_FAILED") {
    // Trade was already resolved (paid, cancelled, etc.)
    return;
  }

  // Check if past deadline
  const failedAt = trade.paymentFailedAt?.getTime() ?? trade.createdAt.getTime();
  if (Date.now() - failedAt > PAYMENT_RETRY_DEADLINE_MS) {
    // Auto-cancel: trade is dead, reopen the sell order
    await prisma.trade.update({
      where: { id: tradeId },
      data: { escrowStatus: "CANCELLED" },
    });

    // Re-open the sell order if it was filled only by this trade
    if (trade.sellOrder) {
      await prisma.order.update({
        where: { id: trade.sellOrderId },
        data: {
          status: "OPEN",
          filledQuantity: { decrement: trade.quantity },
        },
      });

      // Revert card instance back to LISTED
      if (trade.sellOrder.cardInstanceId) {
        await prisma.cardInstance.update({
          where: { id: trade.sellOrder.cardInstanceId },
          data: { status: "LISTED" },
        });
      }
    }

    await createNotification(
      trade.buyerId,
      "ORDER_CANCELLED",
      "Trade Cancelled",
      "Your trade was cancelled due to payment failure. Please update your payment method.",
      { tradeId },
    );

    return;
  }

  // Retry the charge — reset to PENDING first
  await prisma.trade.update({
    where: { id: tradeId },
    data: { escrowStatus: "PENDING" },
  });

  await chargeForTrade(tradeId);
}
