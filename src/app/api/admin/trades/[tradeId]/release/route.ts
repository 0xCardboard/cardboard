import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { releaseEscrow } from "@/services/escrow.service";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (_req: AuthenticatedRequest, context: unknown) => {
  try {
    const { tradeId } = await (context as { params: Promise<{ tradeId: string }> }).params;
    await releaseEscrow(tradeId);
    return NextResponse.json({ message: "Escrow released" });
  } catch (error) {
    return errorResponse(error);
  }
});
