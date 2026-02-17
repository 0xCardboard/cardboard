"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import type { GameWithSetCount, SetWithCardCount } from "@/types/card";

interface CardFiltersProps {
  games: GameWithSetCount[];
}

export function CardFilters({ games }: CardFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sets, setSets] = useState<SetWithCardCount[]>([]);
  const [nameInput, setNameInput] = useState(searchParams.get("name") || "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevGameIdRef = useRef<string>("");

  const currentGameId = searchParams.get("gameId") || "";
  const currentSetId = searchParams.get("setId") || "";
  const currentSortBy = searchParams.get("sortBy") || "";

  // Fetch sets when game changes
  useEffect(() => {
    if (currentGameId === prevGameIdRef.current) return;
    prevGameIdRef.current = currentGameId;

    if (!currentGameId) {
      const timer = setTimeout(() => setSets([]), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    fetch(`/api/games/${currentGameId}/sets`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setSets(json.data || []);
      })
      .catch(() => {
        if (!cancelled) setSets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [currentGameId]);

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/cards?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      setNameInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFilter("name", value);
      }, 300);
    },
    [updateFilter]
  );

  const clearFilters = useCallback(() => {
    setNameInput("");
    router.push("/cards");
  }, [router]);

  const hasFilters = currentGameId || currentSetId || nameInput || currentSortBy;

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold font-[family-name:var(--font-display)] text-muted-foreground uppercase tracking-wider">
        Filters
      </h3>

      <div>
        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Card name..."
            value={nameInput}
            onChange={(e) => handleNameChange(e.target.value)}
            className="pl-9 h-9 rounded-xl bg-secondary/50 border-border/60 focus:border-primary/50"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Game</label>
        <Select value={currentGameId} onValueChange={(v) => {
          updateFilter("setId", "");
          updateFilter("gameId", v);
        }}>
          <SelectTrigger className="rounded-xl bg-secondary/50 border-border/60">
            <SelectValue placeholder="All games" />
          </SelectTrigger>
          <SelectContent>
            {games.map((game) => (
              <SelectItem key={game.id} value={game.id}>
                {game.name} ({game._count.sets})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sets.length > 0 && (
        <div>
          <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Set</label>
          <Select value={currentSetId} onValueChange={(v) => updateFilter("setId", v)}>
            <SelectTrigger className="rounded-xl bg-secondary/50 border-border/60">
              <SelectValue placeholder="All sets" />
            </SelectTrigger>
            <SelectContent>
              {sets.map((set) => (
                <SelectItem key={set.id} value={set.id}>
                  {set.name} ({set._count.cards})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">Sort by</label>
        <Select value={currentSortBy} onValueChange={(v) => updateFilter("sortBy", v)}>
          <SelectTrigger className="rounded-xl bg-secondary/50 border-border/60">
            <SelectValue placeholder="Default" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
          onClick={clearFilters}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
