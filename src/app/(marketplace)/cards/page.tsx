import { Suspense } from "react";
import { getGames, searchCards } from "@/services/card-catalog.service";
import { CardFilters } from "@/components/cards/CardFilters";
import { CardGrid } from "@/components/cards/CardGrid";
import { CardPagination } from "@/components/cards/CardPagination";
import type { CardFilters as CardFiltersType } from "@/types/card";

export default async function BrowseCardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const filters: CardFiltersType = {
    gameId: typeof params.gameId === "string" ? params.gameId : undefined,
    setId: typeof params.setId === "string" ? params.setId : undefined,
    name: typeof params.name === "string" ? params.name : undefined,
    rarity: typeof params.rarity === "string" ? params.rarity : undefined,
    supertype: typeof params.supertype === "string" ? params.supertype : undefined,
    sortBy: typeof params.sortBy === "string" ? (params.sortBy as CardFiltersType["sortBy"]) : undefined,
    sortOrder: typeof params.sortOrder === "string" ? (params.sortOrder as CardFiltersType["sortOrder"]) : undefined,
    page: typeof params.page === "string" ? Number(params.page) : undefined,
    limit: typeof params.limit === "string" ? Number(params.limit) : undefined,
  };

  const [games, result] = await Promise.all([getGames(), searchCards(filters)]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Cards</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <aside className="w-full md:w-64 shrink-0">
          <Suspense>
            <CardFilters games={games} />
          </Suspense>
        </aside>
        <div className="flex-1">
          {result.data.length === 0 ? (
            <p className="text-muted-foreground">
              No cards found matching your filters.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                {result.pagination.total} card{result.pagination.total !== 1 ? "s" : ""} found
              </p>
              <CardGrid cards={result.data} />
              <Suspense>
                <CardPagination pagination={result.pagination} />
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
