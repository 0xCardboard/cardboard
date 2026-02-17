import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { createSetupIntent } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const result = await createSetupIntent(req.user.id);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
});
