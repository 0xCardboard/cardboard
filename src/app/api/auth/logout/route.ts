import { NextResponse } from "next/server";
import { revokeToken } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json();

    await revokeToken(refreshToken);

    return NextResponse.json({ data: { success: true } });
  } catch (error) {
    return errorResponse(error);
  }
}
