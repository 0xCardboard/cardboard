import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getShipmentById } from "@/services/shipment.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, context: unknown) => {
  try {
    const { shipmentId } = await (context as { params: Promise<{ shipmentId: string }> }).params;
    const shipment = await getShipmentById(shipmentId);
    return NextResponse.json({ data: shipment });
  } catch (error) {
    return errorResponse(error);
  }
});
