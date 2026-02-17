import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { createRedemptionShipment } from "@/services/shipment.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { cardInstanceId } = body;

    if (!cardInstanceId) {
      throw new AppError("VALIDATION_ERROR", "cardInstanceId is required");
    }

    const result = await createRedemptionShipment(req.user.id, cardInstanceId);
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
