import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { chargeForTrade, payoutToSeller, refundBuyer } from "@/services/payment.service";
import { createNotification } from "@/services/notification.service";
import { paymentProcessingQueue } from "@/jobs/queue";

const PAYMENT_RETRY_DEADLINE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Process payment for a trade after order matching.
 * Called inline from the matching engine after the transaction commits.
 * On failure, enqueues a retry job (buyer gets 24h to fix their payment method).
 */
export async function processTradePayment(tradeId: string): Promise<void> {
  try {
    await chargeForTrade(tradeId);

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
        "Order Filled",
        `Your sell order was filled at $${(trade.price / 100).toFixed(2)}. Ship your card to complete the trade.`,
        { tradeId },
      );
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
