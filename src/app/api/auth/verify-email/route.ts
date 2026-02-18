import { NextRequest, NextResponse } from "next/server";
import { verifyEmail } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    await verifyEmail(token);

    return NextResponse.json({
      data: { message: "Email verified successfully." },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
