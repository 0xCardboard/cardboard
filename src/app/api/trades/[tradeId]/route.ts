import { NextRequest, NextResponse } from "next/server";
import { getTradeById } from "@/services/trade.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> },
) {
  try {
    const { tradeId } = await params;
    const trade = await getTradeById(tradeId);
    return NextResponse.json({ data: trade });
  } catch (error) {
    return errorResponse(error);
  }
}
