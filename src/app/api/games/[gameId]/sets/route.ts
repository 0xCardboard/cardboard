import { NextResponse } from "next/server";
import { getSetsByGame } from "@/services/card-catalog.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const sets = await getSetsByGame(gameId);
    return NextResponse.json({ data: sets });
  } catch (error) {
    return errorResponse(error);
  }
}
