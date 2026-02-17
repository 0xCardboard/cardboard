import { NextRequest, NextResponse } from "next/server";
import { register } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = withRateLimit(
  RATE_LIMITS.REGISTER,
  "auth:register",
  async (req: NextRequest) => {
    try {
      const { name, email, password } = await req.json();

      const result = await register(email, password, name);

      return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  },
);
