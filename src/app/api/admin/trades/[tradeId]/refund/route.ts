import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { cancelEscrow } from "@/services/escrow.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { tradeId } = await (context as { params: Promise<{ tradeId: string }> }).params;
    const body = await req.json();
    const { reason, amount } = body;

    if (!reason || typeof reason !== "string") {
      throw new AppError("VALIDATION_ERROR", "reason is required");
    }

    await cancelEscrow(tradeId, reason, amount);
    return NextResponse.json({ message: "Buyer refunded" });
  } catch (error) {
    return errorResponse(error);
  }
});
