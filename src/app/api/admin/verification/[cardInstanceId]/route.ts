import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { verifyCard, completeVerification } from "@/services/verification.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { cardInstanceId } = await (
      context as { params: Promise<{ cardInstanceId: string }> }
    ).params;

    const body = await req.json();

    // Support both old format { passed, notes } and new format { approved, notes, rejectReason }
    if ("approved" in body) {
      const { approved, notes, rejectReason } = body;
      if (typeof approved !== "boolean") {
        throw new AppError("VALIDATION_ERROR", "approved (boolean) is required");
      }
      await completeVerification(req.user.id, cardInstanceId, { approved, notes, rejectReason });
    } else {
      const { passed, notes } = body;
      if (typeof passed !== "boolean") {
        throw new AppError("VALIDATION_ERROR", "passed (boolean) is required");
      }
      await verifyCard(req.user.id, cardInstanceId, passed, notes);
    }

    const approved = body.approved ?? body.passed;
    return NextResponse.json({
      message: approved ? "Card verified successfully" : "Card verification failed",
    });
  } catch (error) {
    return errorResponse(error);
  }
});
