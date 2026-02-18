import { NextRequest, NextResponse } from "next/server";
import { login } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withRateLimit(
  RATE_LIMITS.LOGIN,
  "auth:login",
  async (req: NextRequest) => {
    try {
      const { email, password } = await req.json();

      const result = await login(email, password);

      return NextResponse.json({ data: result });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
