import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { resolveDispute } from "@/services/dispute.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const VALID_RESOLUTIONS = ["RESOLVED_REFUND", "RESOLVED_REPLACEMENT", "RESOLVED_REJECTED"] as const;

export const PUT = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { disputeId } = await (context as { params: Promise<{ disputeId: string }> }).params;
    const body = await req.json();
    const { resolution, adminNotes, refundAmount } = body;

    if (!resolution || !VALID_RESOLUTIONS.includes(resolution)) {
      throw new AppError("VALIDATION_ERROR", `resolution must be one of: ${VALID_RESOLUTIONS.join(", ")}`);
    }
    if (!adminNotes || typeof adminNotes !== "string") {
      throw new AppError("VALIDATION_ERROR", "adminNotes is required");
    }

    await resolveDispute(req.user.id, disputeId, resolution, adminNotes, refundAmount);
    return NextResponse.json({ message: "Dispute resolved" });
  } catch (error) {
    return errorResponse(error);
  }
});
