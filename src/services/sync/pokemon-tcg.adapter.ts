import type { CardSyncAdapter, ExternalCardSet, ExternalCard } from "@/types/card";

const BASE_URL = "https://api.pokemontcg.io/v2";
const DEFAULT_SET_LIMIT = 5;

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (process.env.POKEMON_TCG_API_KEY) {
    headers["X-Api-Key"] = process.env.POKEMON_TCG_API_KEY;
  }
  return headers;
}

function getDelay(): number {
  return process.env.POKEMON_TCG_API_KEY ? 150 : 400;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface PokemonTcgSet {
  id: string;
  name: string;
  releaseDate: string;
  total: number;
  images: { logo?: string; symbol?: string };
}

interface PokemonTcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  supertype?: string;
  subtypes?: string[];
  set: { id: string };
  images: { small?: string; large?: string };
  tcgplayer?: {
    prices?: Record<string, { market?: number; low?: number; mid?: number }>;
  };
}

interface PokemonTcgResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export function extractMarketPrice(
  prices: Record<string, { market?: number; low?: number; mid?: number }> | undefined
): number | undefined {
  if (!prices) return undefined;

  const priorityOrder = [
    "holofoil",
    "reverseHolofoil",
    "normal",
    "1stEditionHolofoil",
    "1stEditionNormal",
    "unlimited",
    "unlimitedHolofoil",
  ];

  for (const variant of priorityOrder) {
    if (prices[variant]?.market !== undefined) {
      return prices[variant].market;
    }
  }

  // Fall back to any variant with a market price
  for (const variant of Object.keys(prices)) {
    if (prices[variant]?.market !== undefined) {
      return prices[variant].market;
    }
  }

  return undefined;
}

function mapSet(set: PokemonTcgSet): ExternalCardSet {
  return {
    id: set.id,
    name: set.name,
    releaseDate: set.releaseDate,
    totalCards: set.total,
    logoUrl: set.images.logo ?? undefined,
  };
}

function mapCard(card: PokemonTcgCard): ExternalCard {
  return {
    id: card.id,
    name: card.name,
    setId: card.set.id,
    number: card.number,
    rarity: card.rarity,
    imageUrl: card.images.small ?? undefined,
    imageUrlHiRes: card.images.large ?? undefined,
    supertype: card.supertype,
    subtypes: card.subtypes,
    marketPrice: extractMarketPrice(card.tcgplayer?.prices),
  };
}

export const pokemonTcgAdapter: CardSyncAdapter = {
  gameId: "pokemon",
  gameName: "Pokemon TCG",

  async fetchSets(): Promise<ExternalCardSet[]> {
    const url = `${BASE_URL}/sets?orderBy=-releaseDate&pageSize=${DEFAULT_SET_LIMIT}`;
    const response = await fetch(url, { headers: getHeaders() });

    if (!response.ok) {
      throw new Error(`Pokemon TCG API error fetching sets: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as PokemonTcgResponse<PokemonTcgSet>;
    return json.data.map(mapSet);
  },

  async fetchCards(setId: string): Promise<ExternalCard[]> {
    const cards: ExternalCard[] = [];
    let page = 1;
    const pageSize = 250;
    const delay = getDelay();

    while (true) {
      const url = `${BASE_URL}/cards?q=set.id:${setId}&pageSize=${pageSize}&page=${page}`;
      const response = await fetch(url, { headers: getHeaders() });

      if (!response.ok) {
        throw new Error(
          `Pokemon TCG API error fetching cards for set ${setId}: ${response.status} ${response.statusText}`
        );
      }

      const json = (await response.json()) as PokemonTcgResponse<PokemonTcgCard>;
      cards.push(...json.data.map(mapCard));

      if (cards.length >= json.totalCount) break;

      page++;
      await sleep(delay);
    }

    return cards;
  },
};
