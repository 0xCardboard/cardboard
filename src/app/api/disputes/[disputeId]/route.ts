import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getDisputeById } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_req, context: unknown) => {
  try {
    const { disputeId } = await (context as { params: Promise<{ disputeId: string }> }).params;
    const dispute = await getDisputeById(disputeId);
    return NextResponse.json({ data: dispute });
  } catch (error) {
    return errorResponse(error);
  }
});
