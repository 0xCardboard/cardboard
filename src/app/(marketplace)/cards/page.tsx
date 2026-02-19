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
    character: typeof params.character === "string" ? params.character : undefined,
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">Browse Cards</h1>
        <p className="text-muted-foreground mt-1">
          Explore graded TCG cards across all supported games.
        </p>
      </div>
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 shrink-0">
          <div className="sticky top-24 rounded-2xl border border-border/50 bg-card/50 p-5">
            <Suspense>
              <CardFilters games={games} />
            </Suspense>
          </div>
        </aside>
        <div className="flex-1">
          {result.data.length === 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card/50 p-12 text-center">
              <p className="text-muted-foreground">
                No cards found matching your filters.
              </p>
            </div>
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
