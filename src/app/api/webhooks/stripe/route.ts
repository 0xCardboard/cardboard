import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const tradeId = paymentIntent.metadata?.tradeId;
        if (tradeId) {
          await prisma.trade.update({
            where: { id: tradeId },
            data: { escrowStatus: "CAPTURED", stripePaymentId: paymentIntent.id },
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const tradeId = paymentIntent.metadata?.tradeId;
        if (tradeId) {
          await prisma.trade.update({
            where: { id: tradeId },
            data: { escrowStatus: "PAYMENT_FAILED", paymentFailedAt: new Date() },
          });
        }
        break;
      }

      case "account.updated": {
        // Stripe Connect account updated — could log onboarding completion
        break;
      }

      case "transfer.created": {
        // Transfer to seller created — could log for reconciliation
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
