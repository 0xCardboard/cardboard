import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { openDispute, getUserDisputes } from "@/services/dispute.service";
import { AppError } from "@/lib/errors";
import type { DisputeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_REASONS = ["SHIPPING_DAMAGE", "WRONG_CARD", "GRADE_DISCREPANCY", "NON_DELIVERY", "OTHER"] as const;

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const result = await getUserDisputes(req.user.id, {
      status: (searchParams.get("status") as DisputeStatus) || undefined,
      page: searchParams.has("page") ? Number(searchParams.get("page")) : undefined,
      limit: searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined,
    });

    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { tradeId, reason, description, evidence } = body;

    if (!tradeId || !reason || !description) {
      throw new AppError("VALIDATION_ERROR", "tradeId, reason, and description are required");
    }

    if (!VALID_REASONS.includes(reason)) {
      throw new AppError("VALIDATION_ERROR", `reason must be one of: ${VALID_REASONS.join(", ")}`);
    }

    const result = await openDispute(
      req.user.id,
      tradeId,
      reason,
      description,
      evidence ?? [],
    );

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
