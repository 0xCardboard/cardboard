import { NextResponse } from "next/server";
import { searchCards } from "@/services/card-catalog.service";
import { AppError, errorResponse } from "@/lib/errors";
import type { CardFilters } from "@/types/card";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const page = searchParams.has("page") ? Number(searchParams.get("page")) : undefined;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;

    if (page !== undefined && (isNaN(page) || page < 1)) {
      throw new AppError("VALIDATION_ERROR", "page must be a positive integer");
    }
    if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
      throw new AppError("VALIDATION_ERROR", "limit must be between 1 and 100");
    }

    const filters: CardFilters = {
      gameId: searchParams.get("gameId") || undefined,
      setId: searchParams.get("setId") || undefined,
      name: searchParams.get("name") || undefined,
      rarity: searchParams.get("rarity") || undefined,
      supertype: searchParams.get("supertype") || undefined,
      sortBy: (searchParams.get("sortBy") as CardFilters["sortBy"]) || undefined,
      sortOrder: (searchParams.get("sortOrder") as CardFilters["sortOrder"]) || undefined,
      page,
      limit,
    };

    const result = await searchCards(filters);
    return NextResponse.json({ data: result.data, pagination: result.pagination });
  } catch (error) {
    return errorResponse(error);
  }
}
