import { NextResponse } from "next/server";
import { getGames } from "@/services/card-catalog.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const games = await getGames();
    return NextResponse.json({ data: games });
  } catch (error) {
    return errorResponse(error);
  }
}
