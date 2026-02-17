import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getUserNotifications } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);

    const result = await getUserNotifications(req.user.id, {
      unreadOnly: searchParams.get("unreadOnly") === "true",
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({
      data: result.data,
      pagination: result.pagination,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
