// Re-export auth utilities for convenience
// The full auth service is in src/services/auth.service.ts
export { verifyAccessToken, getUserById } from "@/services/auth.service";
export { withAuth, withAdmin } from "@/lib/auth-middleware";
export type { AuthenticatedRequest } from "@/lib/auth-middleware";
