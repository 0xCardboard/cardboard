import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getUserShipments } from "@/services/shipment.service";
import type { ShipmentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    const result = await getUserShipments(req.user.id, {
      direction: (searchParams.get("direction") as "INBOUND" | "OUTBOUND") || undefined,
      status: (searchParams.get("status") as ShipmentStatus) || undefined,
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});
