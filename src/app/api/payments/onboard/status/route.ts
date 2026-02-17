import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getSellerOnboardingStatus } from "@/services/payment.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const status = await getSellerOnboardingStatus(req.user.id);
    return NextResponse.json({ data: status });
  } catch (error) {
    return errorResponse(error);
  }
});
