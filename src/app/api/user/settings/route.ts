import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse } from "@/lib/errors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const BOOLEAN_FIELDS = [
  "notifyTradeFilled",
  "notifyOrderUpdates",
  "notifyCardVerified",
  "notifyEscrowReleased",
  "notifyShipmentUpdate",
  "notifyDisputeUpdate",
  "notifyPriceAlerts",
  "notifyNewListings",
  "notifyLendingUpdates",
  "notifyAnnouncements",
  "emailDigest",
  "profilePublic",
  "showTradeHistory",
] as const;

const STRING_FIELDS = ["theme", "currency"] as const;

const VALID_THEMES = ["dark", "light"];
const VALID_CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    let settings = await prisma.userSettings.findUnique({
      where: { userId: req.user.id },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: { userId: req.user.id },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, userId: _userId, ...data } = settings;
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const updateData: Record<string, boolean | string> = {};

    for (const field of BOOLEAN_FIELDS) {
      if (field in body && typeof body[field] === "boolean") {
        updateData[field] = body[field];
      }
    }

    for (const field of STRING_FIELDS) {
      if (field in body && typeof body[field] === "string") {
        if (field === "theme" && !VALID_THEMES.includes(body[field])) continue;
        if (field === "currency" && !VALID_CURRENCIES.includes(body[field])) continue;
        updateData[field] = body[field];
      }
    }

    const settings = await prisma.userSettings.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...updateData },
      update: updateData,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, userId: _userId, ...data } = settings;
    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
});
