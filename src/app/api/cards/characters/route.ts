import { NextResponse } from "next/server";
import { getCharacters } from "@/services/card-catalog.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId") || undefined;
    const setId = searchParams.get("setId") || undefined;

    const characters = await getCharacters(gameId, setId);
    return NextResponse.json({ data: characters });
  } catch (error) {
    return errorResponse(error);
  }
}
