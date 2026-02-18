import type { CardSyncAdapter } from "@/types/card";
import { AppError } from "@/lib/errors";
import { pokemonTcgAdapter } from "./pokemon-tcg.adapter";

const adapters: Record<string, CardSyncAdapter> = {
  pokemon: pokemonTcgAdapter,
};

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
