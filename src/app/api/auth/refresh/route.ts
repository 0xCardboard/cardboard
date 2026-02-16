import { NextResponse } from "next/server";
import { refreshAccessToken } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json();

    const tokens = await refreshAccessToken(refreshToken);

    return NextResponse.json({ data: tokens });
  } catch (error) {
    return errorResponse(error);
  }
}
