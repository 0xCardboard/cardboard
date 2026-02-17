import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedRequest } from "@/lib/auth-middleware";
import { errorResponse, AppError } from "@/lib/errors";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        stripeAccountId: true,
        reputation: true,
        _count: {
          select: {
            cardInstances: true,
            orders: true,
            buyTrades: true,
            sellTrades: true,
            reviewsReceived: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError("NOT_FOUND", "User not found");
    }

    return NextResponse.json({
      data: {
        ...user,
        hasSellerAccount: !!user.stripeAccountId,
        stripeAccountId: undefined,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});

export const PUT = withAuth(async (req: AuthenticatedRequest) => {
  try {
    const body = await req.json();
    const { name } = body;

    if (name !== undefined && typeof name !== "string") {
      throw new AppError("VALIDATION_ERROR", "Name must be a string");
    }

    if (name !== undefined && name.length > 100) {
      throw new AppError("VALIDATION_ERROR", "Name must be under 100 characters");
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(name !== undefined && { name: name || null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    });

    return NextResponse.json({ data: user });
  } catch (error) {
    return errorResponse(error);
  }
});
