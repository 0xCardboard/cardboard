export interface CardSyncAdapter {
  gameId: string;
  gameName: string;
  fetchSets(): Promise<ExternalCardSet[]>;
  fetchCards(setId: string): Promise<ExternalCard[]>;
}

export interface ExternalCardSet {
  id: string;
  name: string;
  releaseDate?: string;
  totalCards?: number;
  logoUrl?: string;
}

export interface ExternalCard {
  id: string;
  name: string;
  setId: string;
  number?: string;
  rarity?: string;
  imageUrl?: string;
  imageUrlHiRes?: string;
  supertype?: string;
  subtypes?: string[];
  marketPrice?: number;
}

// --- Catalog types used by services and UI ---

export interface CardWithSet {
  id: string;
  name: string;
  number: string | null;
  rarity: string | null;
  imageUrl: string | null;
  marketPrice: number | null;
  set: {
    id: string;
    name: string;
    game: {
      id: string;
      name: string;
    };
  };
}

export interface CardDetail extends CardWithSet {
  imageUrlHiRes: string | null;
  supertype: string | null;
  subtypes: string[];
  lastPriceSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
  priceHistory: {
    price: number;
    timestamp: Date;
  }[];
}

export interface GameWithSetCount {
  id: string;
  name: string;
  _count: { sets: number };
}

export interface SetWithCardCount {
  id: string;
  name: string;
  gameId: string;
  releaseDate: Date | null;
  totalCards: number | null;
  logoUrl: string | null;
  _count: { cards: number };
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CardFilters {
  gameId?: string;
  setId?: string;
  name?: string;
  character?: string;
  rarity?: string;
  supertype?: string;
  sortBy?: "name" | "price" | "number" | "newest";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export interface SyncResult {
  gamesProcessed: number;
  setsProcessed: number;
  cardsUpserted: number;
  errors: string[];
  durationMs: number;
}

export type CardSyncJobType = "FULL_SYNC" | "SET_SYNC" | "PRICE_SYNC";

export interface CardSyncJobData {
  type: CardSyncJobType;
  gameId?: string;
  setId?: string;
}
