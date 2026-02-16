import { NextResponse } from "next/server";
import { login } from "@/services/auth.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const result = await login(email, password);

    return NextResponse.json({ data: result });
  } catch (error) {
    return errorResponse(error);
  }
}
