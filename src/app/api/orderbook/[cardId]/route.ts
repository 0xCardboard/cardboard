import { NextRequest, NextResponse } from "next/server";
import { getOrderBook } from "@/services/order.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const orderBook = await getOrderBook(cardId);
    return NextResponse.json({ data: orderBook });
  } catch (error) {
    return errorResponse(error);
  }
}
