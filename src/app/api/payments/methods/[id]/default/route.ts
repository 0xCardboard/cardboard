import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { setDefaultPaymentMethod } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export const PUT = withAuth(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { id } = await (context as { params: Promise<{ id: string }> }).params;
    await setDefaultPaymentMethod(req.user.id, id);
    return NextResponse.json({ message: "Default payment method updated" });
  } catch (error) {
    return errorResponse(error);
  }
});
