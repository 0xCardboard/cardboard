import { NextResponse } from "next/server";
import { withAuth, withVerifiedEmail, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { registerCardInstance, getUserCardInstances } from "@/services/card-instance.service";
import { AppError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const filters = {
      cardId: searchParams.get("cardId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    };

    const result = await getUserCardInstances(req.user.id, filters);
    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
});

export const POST = withVerifiedEmail(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { cardId, gradingCompany, certNumber, grade } = body;

    if (!cardId || !gradingCompany || !certNumber || grade === undefined) {
      throw new AppError(
        "VALIDATION_ERROR",
        "cardId, gradingCompany, certNumber, and grade are required",
      );
    }

    if (!["PSA", "BGS", "CGC"].includes(gradingCompany)) {
      throw new AppError("VALIDATION_ERROR", "gradingCompany must be PSA, BGS, or CGC");
    }

    const instance = await registerCardInstance(req.user.id, {
      cardId,
      gradingCompany,
      certNumber,
      grade: parseFloat(grade),
    });

    return NextResponse.json({ data: instance }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
});
