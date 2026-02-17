import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getAdminShipmentQueue } from "@/services/shipment.service";
import type { ShipmentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (req) => {
  try {
    const { searchParams } = new URL(req.url);

    const result = await getAdminShipmentQueue({
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
