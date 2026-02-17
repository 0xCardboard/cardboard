import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { markAllRead } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const count = await markAllRead(req.user.id);
    return NextResponse.json({ message: `${count} notifications marked as read` });
  } catch (error) {
    return errorResponse(error);
  }
});
