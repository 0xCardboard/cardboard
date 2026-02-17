import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { removePaymentMethod } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export const DELETE = withAuth(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    await removePaymentMethod(req.user.id, id);
    return NextResponse.json({ message: "Payment method removed" });
  } catch (error) {
    return errorResponse(error);
  }
});
