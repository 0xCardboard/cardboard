import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/auth-middleware";
import { resendVerification } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    await resendVerification(req.user.id);

    return NextResponse.json({
      data: { message: "Verification email sent." },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
