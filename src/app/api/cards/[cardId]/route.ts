import { NextResponse } from "next/server";
import { getCardById } from "@/services/card-catalog.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const card = await getCardById(cardId);
    return NextResponse.json({ data: card });
  } catch (error) {
    return errorResponse(error);
  }
}
