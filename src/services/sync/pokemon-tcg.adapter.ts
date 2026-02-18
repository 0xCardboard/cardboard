import type { CardSyncAdapter, ExternalCardSet, ExternalCard } from "@/types/card";

const BASE_URL = "https://api.tcgdex.net/v2/en";

const REQUEST_DELAY_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- TCGdex response types ---

interface TcgDexSetBrief {
  id: string;
  name: string;
  logo?: string;
  cardCount?: { total?: number; official?: number };
}

interface TcgDexSetDetail {
  id: string;
  name: string;
  logo?: string;
  releaseDate?: string;
  cardCount?: { total?: number; official?: number };
  cards?: TcgDexCardBrief[];
}

interface TcgDexCardBrief {
  id: string;
  localId: string;
  name: string;
  image?: string;
}

// --- Adapter ---

function mapSet(set: TcgDexSetBrief): ExternalCardSet {
  return {
    id: set.id,
    name: set.name,
    totalCards: set.cardCount?.total ?? set.cardCount?.official,
    logoUrl: set.logo ? `${set.logo}.png` : undefined,
  };
}

export const pokemonTcgAdapter: CardSyncAdapter = {
  gameId: "pokemon",
  gameName: "Pokemon TCG",

  async fetchSets(): Promise<ExternalCardSet[]> {
    const response = await fetch(`${BASE_URL}/sets`);

    if (!response.ok) {
      throw new Error(`TCGdex API error fetching sets: ${response.status} ${response.statusText}`);
    }

    const sets = (await response.json()) as TcgDexSetBrief[];
    return sets.map(mapSet);
  },

  async fetchCards(setId: string): Promise<ExternalCard[]> {
    await sleep(REQUEST_DELAY_MS);

    const response = await fetch(`${BASE_URL}/sets/${setId}`);

    if (!response.ok) {
      throw new Error(
        `TCGdex API error fetching cards for set ${setId}: ${response.status} ${response.statusText}`
      );
    }

    const set = (await response.json()) as TcgDexSetDetail;

    return (set.cards ?? []).map((card) => ({
      id: `${setId}-${card.localId}`,
      name: card.name,
      setId,
      number: card.localId,
      imageUrl: card.image ? `${card.image}/high.webp` : undefined,
      imageUrlHiRes: card.image ? `${card.image}/high.webp` : undefined,
    }));
  },
};
