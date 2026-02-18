import { NextResponse } from "next/server";
import { withAdmin, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { getCertLookupAndScan } from "@/services/verification.service";
import { AppError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** Run cert lookup + fetch PSA scan URL for a card instance */
export const POST = withAdmin(async (req: AuthenticatedRequest, context: unknown) => {
  try {
    const { cardInstanceId } = await (
      context as { params: Promise<{ cardInstanceId: string }> }
    ).params;

    const body = await req.json();
    const { certNumber, gradingCompany } = body;

    if (!certNumber || !gradingCompany) {
      throw new AppError("VALIDATION_ERROR", "certNumber and gradingCompany are required");
    }

    const result = await getCertLookupAndScan(cardInstanceId, certNumber, gradingCompany);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
});
