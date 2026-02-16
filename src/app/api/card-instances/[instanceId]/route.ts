import { NextRequest, NextResponse } from "next/server";
import { getCardInstanceById } from "@/services/card-instance.service";
import { errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> },
) {
  try {
    const { instanceId } = await params;
    const instance = await getCardInstanceById(instanceId);
    return NextResponse.json({ data: instance });
  } catch (error) {
    return errorResponse(error);
  }
}
