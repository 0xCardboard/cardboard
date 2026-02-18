import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getVerificationQueue } from "@/services/verification.service";

export const dynamic = "force-dynamic";

export const GET = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") as "unclaimed" | "my_claims" | "all" | null;

    const result = await getVerificationQueue({
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
      filter: filter ?? "unclaimed",
      adminId: req.user.id,
      certNumber: searchParams.get("certNumber") ?? undefined,
    });

    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});
