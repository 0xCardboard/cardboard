import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { updateShipmentStatus } from "@/services/shipment.service";
import { AppError } from "@/lib/errors";
import type { ShipmentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ShipmentStatus[] = [
  "LABEL_CREATED", "SHIPPED", "IN_TRANSIT", "DELIVERED", "RETURNED", "EXCEPTION",
];

export const PUT = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { shipmentId } = await (context as { params: Promise<{ shipmentId: string }> }).params;
    const body = await req.json();
    const { status, notes } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      throw new AppError("VALIDATION_ERROR", `status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    await updateShipmentStatus(req.user.id, shipmentId, status, notes);
    return NextResponse.json({ message: "Shipment status updated" });
  } catch (error) {
    return errorResponse(error);
  }
});
