import { NextRequest, NextResponse } from "next/server";
import { requestPasswordReset } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withRateLimit(
  RATE_LIMITS.LOGIN, // same rate limit as login — 10 per 15 min
  "auth:forgot-password",
  async (req: NextRequest) => {
    try {
      const { email } = await req.json();

      await requestPasswordReset(email);

      // Always return 200 to avoid leaking whether email exists
      return NextResponse.json({
        data: { message: "If an account exists with that email, we've sent a reset link." },
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
