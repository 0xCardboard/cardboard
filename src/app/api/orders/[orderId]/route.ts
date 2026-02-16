import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { getOrderById, cancelOrder } from "@/services/order.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest, context?: unknown) => {
  try {
    const { orderId } = await (context as { params: Promise<{ orderId: string }> }).params;
    const order = await getOrderById(orderId);
    return NextResponse.json({ data: order });
  } catch (error) {
    return errorResponse(error);
  }
});

export const DELETE = withAuth(async (req: AuthenticatedRequest, context?: unknown) => {
  try {
    const { orderId } = await (context as { params: Promise<{ orderId: string }> }).params;
    const order = await cancelOrder(req.user.id, orderId);
    return NextResponse.json({ data: order });
  } catch (error) {
    return errorResponse(error);
  }
});
