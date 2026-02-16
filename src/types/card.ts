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
