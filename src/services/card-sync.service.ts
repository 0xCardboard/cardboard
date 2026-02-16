import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getAdapter, getAllAdapters } from "./sync";
import type { CardSyncJobData, SyncResult, ExternalCard } from "@/types/card";

const BATCH_SIZE = 50;

export async function runSync(data: CardSyncJobData): Promise<SyncResult> {
  switch (data.type) {
    case "FULL_SYNC":
      return fullSync(data.gameId);
    case "SET_SYNC":
      if (!data.gameId || !data.setId) {
        throw new AppError("VALIDATION_ERROR", "SET_SYNC requires gameId and setId");
      }
      return setSync(data.gameId, data.setId);
    case "PRICE_SYNC":
      return priceSync(data.gameId);
    default:
      throw new AppError("VALIDATION_ERROR", `Unknown sync type: ${data.type}`);
  }
}

export async function fullSync(gameId?: string): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    gamesProcessed: 0,
    setsProcessed: 0,
    cardsUpserted: 0,
    errors: [],
    durationMs: 0,
  };

  const adapters = gameId ? [getAdapter(gameId)] : getAllAdapters();

  for (const adapter of adapters) {
    try {
      // Upsert the game
      await prisma.tcgGame.upsert({
        where: { id: adapter.gameId },
        create: { id: adapter.gameId, name: adapter.gameName },
        update: { name: adapter.gameName },
      });
      result.gamesProcessed++;

      // Fetch and upsert sets
      const sets = await adapter.fetchSets();

      for (const set of sets) {
        try {
          await prisma.cardSet.upsert({
            where: { id: set.id },
            create: {
              id: set.id,
              name: set.name,
              gameId: adapter.gameId,
              releaseDate: set.releaseDate ? new Date(set.releaseDate) : null,
              totalCards: set.totalCards ?? null,
              logoUrl: set.logoUrl ?? null,
            },
            update: {
              name: set.name,
              releaseDate: set.releaseDate ? new Date(set.releaseDate) : null,
              totalCards: set.totalCards ?? null,
              logoUrl: set.logoUrl ?? null,
            },
          });
          result.setsProcessed++;

          // Fetch and upsert cards for this set
          const cards = await adapter.fetchCards(set.id);
          const upserted = await upsertCards(cards);
          result.cardsUpserted += upserted;
        } catch (error) {
          const msg = `Error syncing set ${set.id} (${adapter.gameId}): ${(error as Error).message}`;
          console.error(msg);
          result.errors.push(msg);
        }
      }
    } catch (error) {
      const msg = `Error syncing game ${adapter.gameId}: ${(error as Error).message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}

export async function setSync(gameId: string, setId: string): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    gamesProcessed: 0,
    setsProcessed: 0,
    cardsUpserted: 0,
    errors: [],
    durationMs: 0,
  };

  const adapter = getAdapter(gameId);

  try {
    const cards = await adapter.fetchCards(setId);
    result.cardsUpserted = await upsertCards(cards);
    result.setsProcessed = 1;
  } catch (error) {
    const msg = `Error syncing set ${setId}: ${(error as Error).message}`;
    console.error(msg);
    result.errors.push(msg);
  }

  result.durationMs = Date.now() - start;
  return result;
}

export async function priceSync(gameId?: string): Promise<SyncResult> {
  const start = Date.now();
  const result: SyncResult = {
    gamesProcessed: 0,
    setsProcessed: 0,
    cardsUpserted: 0,
    errors: [],
    durationMs: 0,
  };

  const adapters = gameId ? [getAdapter(gameId)] : getAllAdapters();

  for (const adapter of adapters) {
    try {
      const sets = await adapter.fetchSets();
      result.gamesProcessed++;

      for (const set of sets) {
        try {
          const cards = await adapter.fetchCards(set.id);
          let updated = 0;

          for (const card of cards) {
            if (card.marketPrice !== undefined) {
              const priceCents = Math.round(card.marketPrice * 100);
              await prisma.card.update({
                where: { id: card.id },
                data: {
                  marketPrice: priceCents,
                  lastPriceSync: new Date(),
                },
              });
              updated++;
            }
          }

          result.setsProcessed++;
          result.cardsUpserted += updated;
        } catch (error) {
          const msg = `Error syncing prices for set ${set.id}: ${(error as Error).message}`;
          console.error(msg);
          result.errors.push(msg);
        }
      }
    } catch (error) {
      const msg = `Error in price sync for ${adapter.gameId}: ${(error as Error).message}`;
      console.error(msg);
      result.errors.push(msg);
    }
  }

  result.durationMs = Date.now() - start;
  return result;
}

async function upsertCards(cards: ExternalCard[]): Promise<number> {
  let count = 0;

  // Process in batches
  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((card) =>
        prisma.card.upsert({
          where: { id: card.id },
          create: {
            id: card.id,
            name: card.name,
            setId: card.setId,
            number: card.number ?? null,
            rarity: card.rarity ?? null,
            imageUrl: card.imageUrl ?? null,
            imageUrlHiRes: card.imageUrlHiRes ?? null,
            supertype: card.supertype ?? null,
            subtypes: card.subtypes ?? [],
            marketPrice: card.marketPrice !== undefined ? Math.round(card.marketPrice * 100) : null,
            lastPriceSync: card.marketPrice !== undefined ? new Date() : null,
          },
          update: {
            name: card.name,
            number: card.number ?? null,
            rarity: card.rarity ?? null,
            imageUrl: card.imageUrl ?? null,
            imageUrlHiRes: card.imageUrlHiRes ?? null,
            supertype: card.supertype ?? null,
            subtypes: card.subtypes ?? [],
            marketPrice: card.marketPrice !== undefined ? Math.round(card.marketPrice * 100) : null,
            lastPriceSync: card.marketPrice !== undefined ? new Date() : null,
          },
        })
      )
    );

    count += batch.length;
  }

  return count;
}
