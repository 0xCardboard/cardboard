import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import {
  ensureStripeCustomer,
  savePaymentMethod,
  getUserPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  chargeForTrade,
  payoutToSeller,
  refundBuyer,
} from "@/services/payment.service";

describe("payment.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureStripeCustomer", () => {
    it("returns existing customer ID", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        stripeCustomerId: "cus_existing",
      });

      const id = await ensureStripeCustomer("user-1");
      expect(id).toBe("cus_existing");
      expect(stripe.customers.create).not.toHaveBeenCalled();
    });

    it("creates new customer if none exists", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        email: "test@test.com",
        stripeCustomerId: null,
      });
      (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "cus_new",
      });
      (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const id = await ensureStripeCustomer("user-1");
      expect(id).toBe("cus_new");
      expect(stripe.customers.create).toHaveBeenCalledWith({
        email: "test@test.com",
        metadata: { userId: "user-1" },
      });
    });

    it("throws NOT_FOUND for missing user", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      await expect(ensureStripeCustomer("nonexistent")).rejects.toThrow("User not found");
    });
  });

  describe("chargeForTrade", () => {
    it("charges buyer and updates trade to CAPTURED", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        sellerId: "seller-1",
        price: 5000,
        quantity: 1,
        escrowStatus: "PENDING",
        fee: { amount: 150 },
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "buyer-1",
        stripeCustomerId: "cus_buyer",
      });
      (prisma.paymentMethod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        stripePaymentMethodId: "pm_123",
      });
      (stripe.paymentIntents.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pi_123",
      });
      (prisma.trade.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await chargeForTrade("trade-1");

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: "usd",
          customer: "cus_buyer",
          payment_method: "pm_123",
          confirm: true,
          off_session: true,
        }),
        { idempotencyKey: "trade_trade-1_charge" },
      );

      expect(prisma.trade.update).toHaveBeenCalledWith({
        where: { id: "trade-1" },
        data: { stripePaymentId: "pi_123", escrowStatus: "CAPTURED" },
      });
    });

    it("marks PAYMENT_FAILED when buyer has no payment method", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        buyerId: "buyer-1",
        price: 5000,
        quantity: 1,
        escrowStatus: "PENDING",
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "buyer-1",
        stripeCustomerId: "cus_buyer",
      });
      (prisma.paymentMethod.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (prisma.trade.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await expect(chargeForTrade("trade-1")).rejects.toThrow(
        "Buyer has no default payment method",
      );

      expect(prisma.trade.update).toHaveBeenCalledWith({
        where: { id: "trade-1" },
        data: { escrowStatus: "PAYMENT_FAILED", paymentFailedAt: expect.any(Date) },
      });
    });

    it("rejects non-PENDING trades", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        escrowStatus: "CAPTURED",
      });

      await expect(chargeForTrade("trade-1")).rejects.toThrow("expected PENDING");
    });
  });

  describe("payoutToSeller", () => {
    it("transfers funds minus fee to seller", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        sellerId: "seller-1",
        price: 5000,
        quantity: 1,
        escrowStatus: "CAPTURED",
        fee: { amount: 150 },
      });
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "seller-1",
        stripeAccountId: "acct_seller",
      });
      (stripe.transfers.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "tr_123",
      });
      (prisma.trade.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await payoutToSeller("trade-1");

      expect(stripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4850, // 5000 - 150
          destination: "acct_seller",
        }),
        { idempotencyKey: "trade_trade-1_payout" },
      );
    });
  });

  describe("refundBuyer", () => {
    it("creates a Stripe refund", async () => {
      (prisma.trade.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "trade-1",
        stripePaymentId: "pi_123",
        escrowStatus: "CAPTURED",
      });
      (stripe.refunds.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "re_123",
      });
      (prisma.trade.update as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await refundBuyer("trade-1", "verification failed");

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: "pi_123",
        }),
        { idempotencyKey: "trade_trade-1_refund" },
      );
      expect(prisma.trade.update).toHaveBeenCalledWith({
        where: { id: "trade-1" },
        data: { stripeRefundId: "re_123", escrowStatus: "REFUNDED" },
      });
    });
  });

  describe("savePaymentMethod", () => {
    it("saves payment method and sets first as default", async () => {
      (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "user-1",
        stripeCustomerId: "cus_1",
      });
      (stripe.paymentMethods.attach as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (stripe.paymentMethods.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm_123",
        card: { last4: "4242", brand: "visa", exp_month: 12, exp_year: 2025 },
      });
      (prisma.paymentMethod.count as ReturnType<typeof vi.fn>).mockResolvedValue(0);
      (prisma.paymentMethod.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm-db-1",
        last4: "4242",
        brand: "visa",
      });

      const result = await savePaymentMethod("user-1", "pm_123");
      expect(result.last4).toBe("4242");
      expect(prisma.paymentMethod.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ isDefault: true }),
      });
    });
  });

  describe("getUserPaymentMethods", () => {
    it("returns user payment methods", async () => {
      (prisma.paymentMethod.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "pm-1", last4: "4242", brand: "visa" },
      ]);

      const result = await getUserPaymentMethods("user-1");
      expect(result).toHaveLength(1);
    });
  });

  describe("removePaymentMethod", () => {
    it("detaches from Stripe and deletes", async () => {
      (prisma.paymentMethod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm-1",
        userId: "user-1",
        stripePaymentMethodId: "pm_stripe",
        isDefault: false,
      });
      (stripe.paymentMethods.detach as ReturnType<typeof vi.fn>).mockResolvedValue({});
      (prisma.paymentMethod.delete as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await removePaymentMethod("user-1", "pm-1");
      expect(stripe.paymentMethods.detach).toHaveBeenCalledWith("pm_stripe");
    });

    it("throws FORBIDDEN for wrong user", async () => {
      (prisma.paymentMethod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm-1",
        userId: "other-user",
      });

      await expect(removePaymentMethod("user-1", "pm-1")).rejects.toThrow(
        "Not your payment method",
      );
    });
  });

  describe("setDefaultPaymentMethod", () => {
    it("sets new default", async () => {
      (prisma.paymentMethod.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "pm-1",
        userId: "user-1",
      });
      (prisma.$transaction as ReturnType<typeof vi.fn>).mockResolvedValue([{}, {}]);

      await setDefaultPaymentMethod("user-1", "pm-1");
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
