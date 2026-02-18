import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { placeOrder, getUserOrders } from "@/services/order.service";
import { AppError, errorResponse } from "@/lib/errors";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      side: (searchParams.get("side") as "BUY" | "SELL") ?? undefined,
      status: (searchParams.get("status") as "OPEN" | "PARTIALLY_FILLED" | "FILLED" | "CANCELLED") ?? undefined,
      cardId: searchParams.get("cardId") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    };

    const result = await getUserOrders(req.user.id, filters);
    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withRateLimit(
  RATE_LIMITS.ORDERS,
  "orders:place",
  withAuth(async (req: AuthenticatedRequest) => {
    try {
      const body = await req.json();
      const { cardId, side, type, price, quantity, cardInstanceId, certNumber, gradingCompany, grade, minGrade, idempotencyKey } = body;

      if (!cardId || !side || !type) {
        throw new AppError("VALIDATION_ERROR", "cardId, side, and type are required");
      }

      if (!["BUY", "SELL"].includes(side)) {
        throw new AppError("VALIDATION_ERROR", "side must be BUY or SELL");
      }

      if (!["LIMIT", "MARKET"].includes(type)) {
        throw new AppError("VALIDATION_ERROR", "type must be LIMIT or MARKET");
      }

      const order = await placeOrder(req.user.id, {
        cardId,
        side,
        type,
        price: price !== undefined ? parseInt(price) : undefined,
        quantity: quantity !== undefined ? parseInt(quantity) : undefined,
        cardInstanceId,
        certNumber,
        gradingCompany,
        grade: grade !== undefined ? parseFloat(grade) : undefined,
        minGrade: minGrade !== undefined ? parseFloat(minGrade) : undefined,
        idempotencyKey,
      });

      return NextResponse.json({ data: order }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }),
);
