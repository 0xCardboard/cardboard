import { redis } from "@/lib/redis";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Sliding window rate limiter using Redis.
 * Uses atomic MULTI with INCR + EXPIRE for safe concurrent access.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `${redisKey}:${Math.floor(now / windowSeconds)}`;

  const results = await redis
    .multi()
    .incr(windowKey)
    .expire(windowKey, windowSeconds)
    .exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  const remaining = Math.max(0, limit - count);
  const resetAt =
    (Math.floor(now / windowSeconds) + 1) * windowSeconds;

  return {
    allowed: count <= limit,
    remaining,
    resetAt,
  };
}

/**
 * Rate limit configuration for different endpoint categories.
 */
export const RATE_LIMITS = {
  LOGIN: { limit: 10, windowSeconds: 15 * 60 },
  REGISTER: { limit: 5, windowSeconds: 60 * 60 },
  ORDERS: { limit: 30, windowSeconds: 60 },
  DISPUTES: { limit: 5, windowSeconds: 60 * 60 },
  SHIPMENTS: { limit: 20, windowSeconds: 60 },
  API_GENERAL: { limit: 100, windowSeconds: 60 },
} as const;
