import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { cardSyncQueue } from "@/jobs/queue";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const POST = withAdmin(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { type, gameId, setId } = body;

    if (!["FULL_SYNC", "SET_SYNC", "PRICE_SYNC"].includes(type)) {
      throw new AppError("VALIDATION_ERROR", "type must be FULL_SYNC, SET_SYNC, or PRICE_SYNC");
    }

    const job = await cardSyncQueue.add(
      "sync",
      { type, gameId, setId },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );

    return NextResponse.json({ data: { jobId: job.id, status: "queued" } });
  } catch (error) {
    return errorResponse(error);
  }
});
