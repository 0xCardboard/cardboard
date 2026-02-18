import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken, getUserById } from "@/services/auth.service";
import { AppError, errorResponse } from "@/lib/errors";

export interface AuthenticatedRequest extends NextRequest {
  user: {
    id: string;
    role: string;
  };
}

type RouteHandler = (req: AuthenticatedRequest, context?: unknown) => Promise<NextResponse>;

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function withAuth(handler: RouteHandler) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        throw new AppError("UNAUTHORIZED", "Authentication required");
      }

      const payload = verifyAccessToken(token);

      // Attach user info to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.user = { id: payload.sub, role: payload.role };

      return await handler(authenticatedReq, context);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function withAdmin(handler: RouteHandler) {
  return withAuth(async (req: AuthenticatedRequest, context?: unknown) => {
    if (req.user.role !== "ADMIN") {
      return errorResponse(new AppError("FORBIDDEN", "Admin access required"));
    }
    return handler(req, context);
  });
}

/**
 * Wraps a route handler to require both authentication AND a verified email.
 * Returns 403 if email is not verified.
 */
export function withVerifiedEmail(handler: RouteHandler) {
  return withAuth(async (req: AuthenticatedRequest, context?: unknown) => {
    const user = await getUserById(req.user.id);
    if (!user || !user.emailVerified) {
      return errorResponse(
        new AppError("FORBIDDEN", "Email verification required", {
          resendUrl: "/api/auth/resend-verification",
        }),
      );
    }
    return handler(req, context);
  });
}
