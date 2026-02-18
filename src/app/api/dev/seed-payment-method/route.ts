import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * DEV ONLY: Creates a test payment method for the authenticated user.
 * This allows testing buy orders without a real Stripe integration.
 */
export const POST = withAuth(async (req: AuthenticatedRequest) => {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 },
    );
  }

  try {
    const existing = await prisma.paymentMethod.findFirst({
      where: { userId: req.user.id, isDefault: true },
    });

    if (existing) {
      return NextResponse.json({
        data: existing,
        message: "Test payment method already exists",
      });
    }

    const pm = await prisma.paymentMethod.create({
      data: {
        userId: req.user.id,
        stripePaymentMethodId: `pm_test_${req.user.id.slice(0, 8)}`,
        last4: "4242",
        brand: "visa",
        expMonth: 12,
        expYear: 2030,
        isDefault: true,
      },
    });

    return NextResponse.json({
      data: pm,
      message: "Test payment method created (Visa ending 4242)",
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
