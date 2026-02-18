import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { claimCard, unclaimCard } from "@/services/verification.service";

export const dynamic = "force-dynamic";

/** Claim a card for verification */
export const POST = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { cardInstanceId } = await (
      context as { params: Promise<{ cardInstanceId: string }> }
    ).params;

    const result = await claimCard(req.user.id, cardInstanceId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
});

/** Unclaim a card */
export const DELETE = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { cardInstanceId } = await (
      context as { params: Promise<{ cardInstanceId: string }> }
    ).params;

    await unclaimCard(req.user.id, cardInstanceId);
    return NextResponse.json({ message: "Card unclaimed" });
  } catch (error) {
    return errorResponse(error);
  }
});
