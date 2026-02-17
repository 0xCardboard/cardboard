import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { AppError } from "@/lib/errors";

/**
 * Lazily creates a Stripe Customer for the user if one doesn't exist.
 * Returns the Stripe Customer ID.
 */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/**
 * Creates a SetupIntent for the buyer to save a payment method via Stripe Elements.
 */
export async function createSetupIntent(userId: string): Promise<{
  clientSecret: string;
  setupIntentId: string;
}> {
  const customerId = await ensureStripeCustomer(userId);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    metadata: { userId },
  });

  return {
    clientSecret: setupIntent.client_secret!,
    setupIntentId: setupIntent.id,
  };
}

/**
 * After a SetupIntent is confirmed, save the payment method to the database.
 */
export async function savePaymentMethod(
  userId: string,
  stripePaymentMethodId: string,
): Promise<{ id: string; last4: string; brand: string }> {
  const customerId = await ensureStripeCustomer(userId);

  // Attach payment method to customer
  await stripe.paymentMethods.attach(stripePaymentMethodId, {
    customer: customerId,
  });

  // Fetch payment method details
  const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

  if (!pm.card) {
    throw new AppError("VALIDATION_ERROR", "Only card payment methods are supported");
  }

  // Check if user already has payment methods
  const existingCount = await prisma.paymentMethod.count({
    where: { userId },
  });

  const paymentMethod = await prisma.paymentMethod.create({
    data: {
      userId,
      stripePaymentMethodId: pm.id,
      last4: pm.card.last4,
      brand: pm.card.brand,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      isDefault: existingCount === 0, // First card is default
    },
  });

  return { id: paymentMethod.id, last4: paymentMethod.last4, brand: paymentMethod.brand };
}

/**
 * List user's saved payment methods.
 */
export async function getUserPaymentMethods(userId: string) {
  return prisma.paymentMethod.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      last4: true,
      brand: true,
      expMonth: true,
      expYear: true,
      isDefault: true,
      createdAt: true,
    },
  });
}

/**
 * Remove a saved payment method.
 */
export async function removePaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
  const pm = await prisma.paymentMethod.findUnique({
    where: { id: paymentMethodId },
  });

  if (!pm) throw new AppError("NOT_FOUND", "Payment method not found");
  if (pm.userId !== userId) throw new AppError("FORBIDDEN", "Not your payment method");

  // Detach from Stripe
  await stripe.paymentMethods.detach(pm.stripePaymentMethodId);

  // Delete from DB
  await prisma.paymentMethod.delete({ where: { id: paymentMethodId } });

  // If it was default, make the next one default
  if (pm.isDefault) {
    const next = await prisma.paymentMethod.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (next) {
      await prisma.paymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
}

/**
 * Set a payment method as the default.
 */
export async function setDefaultPaymentMethod(
  userId: string,
  paymentMethodId: string,
): Promise<void> {
  const pm = await prisma.paymentMethod.findUnique({
    where: { id: paymentMethodId },
  });

  if (!pm) throw new AppError("NOT_FOUND", "Payment method not found");
  if (pm.userId !== userId) throw new AppError("FORBIDDEN", "Not your payment method");

  // Unset all existing defaults, then set the new one
  await prisma.$transaction([
    prisma.paymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    }),
  ]);
}

/**
 * Charge the buyer for a trade. Called after order matching.
 * Uses the buyer's default payment method for an off-session charge.
 */
export async function chargeForTrade(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { fee: true },
  });

  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");
  if (trade.escrowStatus !== "PENDING") {
    throw new AppError("VALIDATION_ERROR", `Trade escrow is ${trade.escrowStatus}, expected PENDING`);
  }

  const buyer = await prisma.user.findUnique({ where: { id: trade.buyerId } });
  if (!buyer?.stripeCustomerId) {
    throw new AppError("VALIDATION_ERROR", "Buyer has no Stripe customer");
  }

  const defaultPm = await prisma.paymentMethod.findFirst({
    where: { userId: trade.buyerId, isDefault: true },
  });

  if (!defaultPm) {
    // Mark as payment failed
    await prisma.trade.update({
      where: { id: tradeId },
      data: { escrowStatus: "PAYMENT_FAILED", paymentFailedAt: new Date() },
    });
    throw new AppError("VALIDATION_ERROR", "Buyer has no default payment method");
  }

  const totalAmount = trade.price * trade.quantity;

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: totalAmount,
        currency: "usd",
        customer: buyer.stripeCustomerId,
        payment_method: defaultPm.stripePaymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          tradeId: trade.id,
          buyerId: trade.buyerId,
          sellerId: trade.sellerId,
        },
      },
      { idempotencyKey: `trade_${tradeId}_charge` },
    );

    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        stripePaymentId: paymentIntent.id,
        escrowStatus: "CAPTURED",
      },
    });
  } catch (error) {
    await prisma.trade.update({
      where: { id: tradeId },
      data: { escrowStatus: "PAYMENT_FAILED", paymentFailedAt: new Date() },
    });
    throw error;
  }
}

/**
 * Transfer funds to seller's connected account after card verification.
 */
export async function payoutToSeller(tradeId: string): Promise<void> {
  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { fee: true },
  });

  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");
  if (trade.escrowStatus !== "CAPTURED") {
    throw new AppError("VALIDATION_ERROR", `Cannot payout: escrow is ${trade.escrowStatus}`);
  }

  const seller = await prisma.user.findUnique({ where: { id: trade.sellerId } });
  if (!seller?.stripeAccountId) {
    throw new AppError("VALIDATION_ERROR", "Seller has no Stripe Connect account");
  }

  const totalAmount = trade.price * trade.quantity;
  const feeAmount = trade.fee?.amount ?? 0;
  const sellerAmount = totalAmount - feeAmount;

  const transfer = await stripe.transfers.create(
    {
      amount: sellerAmount,
      currency: "usd",
      destination: seller.stripeAccountId,
      metadata: {
        tradeId: trade.id,
        sellerId: trade.sellerId,
      },
    },
    { idempotencyKey: `trade_${tradeId}_payout` },
  );

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      stripeTransferId: transfer.id,
      escrowStatus: "RELEASED",
    },
  });
}

/**
 * Refund the buyer for a failed verification or dispute.
 */
export async function refundBuyer(
  tradeId: string,
  reason: string,
  amount?: number,
): Promise<void> {
  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });

  if (!trade) throw new AppError("NOT_FOUND", "Trade not found");
  if (!trade.stripePaymentId) {
    throw new AppError("VALIDATION_ERROR", "Trade has no payment to refund");
  }
  if (trade.escrowStatus !== "CAPTURED" && trade.escrowStatus !== "RELEASED") {
    throw new AppError("VALIDATION_ERROR", `Cannot refund: escrow is ${trade.escrowStatus}`);
  }

  const refundParams: { payment_intent: string; reason: "requested_by_customer"; metadata: Record<string, string>; amount?: number } = {
    payment_intent: trade.stripePaymentId,
    reason: "requested_by_customer",
    metadata: { tradeId: trade.id, reason },
  };

  if (amount) {
    refundParams.amount = amount;
  }

  const refund = await stripe.refunds.create(refundParams, {
    idempotencyKey: `trade_${tradeId}_refund`,
  });

  await prisma.trade.update({
    where: { id: tradeId },
    data: {
      stripeRefundId: refund.id,
      escrowStatus: "REFUNDED",
    },
  });
}

/**
 * Create Stripe Connect onboarding link for sellers.
 */
export async function createSellerOnboardingLink(
  userId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<{ url: string; accountId: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  let accountId = user.stripeAccountId;

  if (!accountId) {
    // Create a new Express connected account
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      metadata: { userId: user.id },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    accountId = account.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    return_url: returnUrl,
    refresh_url: refreshUrl,
    type: "account_onboarding",
  });

  return { url: accountLink.url, accountId };
}

/**
 * Check seller's Stripe Connect onboarding status.
 */
export async function getSellerOnboardingStatus(userId: string): Promise<{
  hasAccount: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  if (!user.stripeAccountId) {
    return {
      hasAccount: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  const account = await stripe.accounts.retrieve(user.stripeAccountId);

  return {
    hasAccount: true,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}
