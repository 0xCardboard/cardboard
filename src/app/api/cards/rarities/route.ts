import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId") || undefined;
    const setId = searchParams.get("setId") || undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      rarity: { not: null },
    };

    if (setId) {
      where.setId = setId;
    } else if (gameId) {
      where.set = { gameId };
    }

    const results = await prisma.card.findMany({
      where,
      select: { rarity: true },
      distinct: ["rarity"],
      orderBy: { rarity: "asc" },
    });

    const rarities = results
      .map((r) => r.rarity)
      .filter((r): r is string => r !== null);

    return NextResponse.json({ data: rarities });
  } catch (error) {
    return errorResponse(error);
  }
}
