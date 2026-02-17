import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getVerificationQueue } from "@/services/verification.service";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getVerificationQueue({
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});
