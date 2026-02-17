import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { markRead } from "@/services/notification.service";

export const dynamic = "force-dynamic";

export const PUT = withAuth(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { notificationId } = await (
      context as { params: Promise<{ notificationId: string }> }
    ).params;
    await markRead(req.user.id, notificationId);
    return NextResponse.json({ message: "Notification marked as read" });
  } catch (error) {
    return errorResponse(error);
  }
});
