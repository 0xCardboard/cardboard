import type { CardSyncAdapter, ExternalCardSet, ExternalCard } from "@/types/card";

const BASE_URL = "https://optcgapi.com/api";
const DEFAULT_SET_LIMIT = 5;
const REQUEST_DELAY_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface OptcgSet {
  id?: number;
  set_id?: string;
  set_name?: string;
  name?: string;
  release_date?: string;
  total_cards?: number;
  card_count?: number;
}

interface OptcgCard {
  id?: number;
  card_id?: string;
  card_name?: string;
  name?: string;
  set_id?: string;
  card_number?: string;
  number?: string;
  rarity?: string;
  card_type?: string;
  type?: string;
  card_image?: string;
  image_url?: string;
  market_price?: number;
  price?: number;
}

function mapSet(raw: OptcgSet): ExternalCardSet {
  const id = raw.set_id ?? raw.name ?? `OP-${raw.id}`;
  return {
    id,
    name: raw.set_name ?? raw.name ?? id,
    releaseDate: raw.release_date ?? undefined,
    totalCards: raw.total_cards ?? raw.card_count ?? undefined,
    logoUrl: undefined,
  };
}

function mapCard(raw: OptcgCard, setId: string): ExternalCard {
  const id = raw.card_id ?? raw.card_number ?? `${setId}-${raw.id}`;
  return {
    id,
    name: raw.card_name ?? raw.name ?? id,
    setId,
    number: raw.card_number ?? raw.number ?? undefined,
    rarity: raw.rarity ?? undefined,
    imageUrl: raw.card_image ?? raw.image_url ?? undefined,
    imageUrlHiRes: undefined,
    supertype: raw.card_type ?? raw.type ?? undefined,
    subtypes: undefined,
    marketPrice: raw.market_price ?? raw.price ?? undefined,
  };
}

export const onepieceAdapter: CardSyncAdapter = {
  gameId: "onepiece",
  gameName: "One Piece TCG",

  async fetchSets(): Promise<ExternalCardSet[]> {
    try {
      const response = await fetch(`${BASE_URL}/allSets/`);

      if (!response.ok) {
        console.warn(`OPTCG API error fetching sets: ${response.status} ${response.statusText}`);
        return [];
      }

      const data = await response.json();
      const rawSets: OptcgSet[] = Array.isArray(data) ? data : data.data ?? data.results ?? [];

      const sets = rawSets.map(mapSet);

      // Sort by ID (higher number = more recent) and take the most recent sets
      sets.sort((a, b) => {
        const numA = parseInt(a.id.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.id.replace(/\D/g, ""), 10) || 0;
        return numB - numA;
      });

      return sets.slice(0, DEFAULT_SET_LIMIT);
    } catch (error) {
      console.warn("OPTCG API unreachable, returning empty sets:", (error as Error).message);
      return [];
    }
  },

  async fetchCards(setId: string): Promise<ExternalCard[]> {
    try {
      await sleep(REQUEST_DELAY_MS);

      const response = await fetch(`${BASE_URL}/sets/${setId}/`);

      if (!response.ok) {
        console.warn(`OPTCG API error fetching cards for set ${setId}: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const rawCards: OptcgCard[] = Array.isArray(data) ? data : data.data ?? data.results ?? data.cards ?? [];

      return rawCards.map((card) => mapCard(card, setId));
    } catch (error) {
      console.warn(`OPTCG API error fetching cards for set ${setId}:`, (error as Error).message);
      return [];
    }
  },
};
