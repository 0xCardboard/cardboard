import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { verifyCard } from "@/services/verification.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { cardInstanceId } = await (
      context as { params: Promise<{ cardInstanceId: string }> }
    ).params;

    const body = await req.json();
    const { passed, notes } = body;

    if (typeof passed !== "boolean") {
      throw new AppError("VALIDATION_ERROR", "passed (boolean) is required");
    }

    await verifyCard(req.user.id, cardInstanceId, passed, notes);
    return NextResponse.json({
      message: passed ? "Card verified successfully" : "Card verification failed",
    });
  } catch (error) {
    return errorResponse(error);
  }
});
