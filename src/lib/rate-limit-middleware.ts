import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { AuthenticatedRequest } from "@/lib/auth-middleware";

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

/**
 * Extracts a rate limit key from the request.
 * Uses user ID if authenticated, otherwise falls back to IP.
 */
function getRateLimitKey(req: NextRequest, prefix: string): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.id) {
    return `${prefix}:user:${authReq.user.id}`;
  }
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return `${prefix}:ip:${ip}`;
}

/**
 * Higher-order function that wraps a route handler with rate limiting.
 * Returns 429 with standard headers when limit is exceeded.
 */
export function withRateLimit<T extends NextRequest>(
  config: RateLimitConfig,
  prefix: string,
  handler: (req: T, context?: unknown) => Promise<NextResponse>,
) {
  return async (req: T, context?: unknown): Promise<NextResponse> => {
    const key = getRateLimitKey(req, prefix);
    const result = await rateLimit(key, config.limit, config.windowSeconds);

    if (!result.allowed) {
      const retryAfter = result.resetAt - Math.floor(Date.now() / 1000);
      return NextResponse.json(
        { error: "Too many requests", retryAfter },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(config.limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(result.resetAt),
            "Retry-After": String(retryAfter),
          },
        },
      );
    }

    const response = await handler(req, context);

    // Attach rate limit headers to successful responses
    response.headers.set("X-RateLimit-Limit", String(config.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    response.headers.set("X-RateLimit-Reset", String(result.resetAt));

    return response;
  };
}
