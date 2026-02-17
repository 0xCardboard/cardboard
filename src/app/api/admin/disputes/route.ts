import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getAdminDisputeQueue } from "@/services/dispute.service";
import type { DisputeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getAdminDisputeQueue({
      status: (searchParams.get("status") as DisputeStatus) || undefined,
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});
