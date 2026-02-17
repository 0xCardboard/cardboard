import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { createSellerOnboardingLink } from "@/services/payment.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { returnUrl, refreshUrl } = body;

    if (!returnUrl || !refreshUrl) {
      throw new AppError("VALIDATION_ERROR", "returnUrl and refreshUrl are required");
    }

    const result = await createSellerOnboardingLink(req.user.id, returnUrl, refreshUrl);
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
});
