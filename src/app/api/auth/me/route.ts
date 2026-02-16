import { NextResponse } from "next/server";
import { withAuth, AuthenticatedRequest } from "@/lib/auth-middleware";
import { getUserById } from "@/services/auth.service";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) {
      throw new AppError("NOT_FOUND", "User not found");
    }

    return NextResponse.json({ data: user });
  } catch (error) {
    return errorResponse(error);
  }
});
