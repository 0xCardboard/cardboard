import type { CardSyncAdapter } from "@/types/card";
import { AppError } from "@/lib/errors";
import { pokemonTcgAdapter } from "./pokemon-tcg.adapter";
import { onepieceAdapter } from "./onepiece.adapter";

const allAdapters: Record<string, CardSyncAdapter> = {
  pokemon: pokemonTcgAdapter,
  onepiece: onepieceAdapter,
};

// Filter adapters by ENABLED_GAMES env var (comma-separated).
// Defaults to "pokemon" for beta — set to "pokemon,onepiece" for full catalog.
const enabledGames = (process.env.ENABLED_GAMES || "pokemon")
  .split(",")
  .map((g) => g.trim().toLowerCase())
  .filter(Boolean);

const adapters: Record<string, CardSyncAdapter> = Object.fromEntries(
  Object.entries(allAdapters).filter(([id]) => enabledGames.includes(id))
);

export function getAdapter(gameId: string): CardSyncAdapter {
  const adapter = adapters[gameId];
  if (!adapter) {
    throw new AppError("NOT_FOUND", `No sync adapter for game: ${gameId}`);
  }
  return adapter;
}

export function getAllAdapters(): CardSyncAdapter[] {
  return Object.values(adapters);
}
