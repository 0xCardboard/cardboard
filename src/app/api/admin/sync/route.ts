import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { runSync } from "@/services/card-sync.service";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { type, gameId, setId } = body;

    if (!["FULL_SYNC", "SET_SYNC", "PRICE_SYNC"].includes(type)) {
      throw new AppError("VALIDATION_ERROR", "type must be FULL_SYNC, SET_SYNC, or PRICE_SYNC");
    }

    const result = await runSync({ type, gameId, setId });
    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
});
