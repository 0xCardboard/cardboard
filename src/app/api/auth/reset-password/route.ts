import { NextRequest, NextResponse } from "next/server";
import { resetPassword } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();

    await resetPassword(token, newPassword);

    return NextResponse.json({
      data: { message: "Password has been reset successfully." },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
