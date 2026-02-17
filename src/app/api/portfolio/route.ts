import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { getUserPortfolio } from "@/services/portfolio.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    };

    const result = await getUserPortfolio(req.user.id, filters);
    return NextResponse.json({
      data: result.instances,
      summary: result.summary,
      pagination: result.pagination,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
