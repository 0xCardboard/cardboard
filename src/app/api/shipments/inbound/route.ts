import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { createInboundShipment } from "@/services/shipment.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { tradeId, cardInstanceId, trackingNumber, carrier } = body;

    if (!tradeId || !cardInstanceId || !trackingNumber || !carrier) {
      throw new AppError("VALIDATION_ERROR", "tradeId, cardInstanceId, trackingNumber, and carrier are required");
    }

    const result = await createInboundShipment(
      req.user.id,
      tradeId,
      cardInstanceId,
      trackingNumber,
      carrier,
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
