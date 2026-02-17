import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getUserPaymentMethods, savePaymentMethod } from "@/services/payment.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const methods = await getUserPaymentMethods(req.user.id);
    return NextResponse.json({ data: methods });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { stripePaymentMethodId } = body;

    if (!stripePaymentMethodId || typeof stripePaymentMethodId !== "string") {
      throw new AppError("VALIDATION_ERROR", "stripePaymentMethodId is required");
    }

    const result = await savePaymentMethod(req.user.id, stripePaymentMethodId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
