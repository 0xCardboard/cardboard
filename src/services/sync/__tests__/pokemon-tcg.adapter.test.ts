import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pokemonTcgAdapter, extractMarketPrice } from "../pokemon-tcg.adapter";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function createSetResponse(sets: object[], totalCount?: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: sets,
        page: 1,
        pageSize: 5,
        count: sets.length,
        totalCount: totalCount ?? sets.length,
      }),
  };
}

function createCardResponse(cards: object[], page = 1, totalCount?: number) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        data: cards,
        page,
        pageSize: 250,
        count: cards.length,
        totalCount: totalCount ?? cards.length,
      }),
  };
}

const sampleSet = {
  id: "sv8",
  name: "Surging Sparks",
  releaseDate: "2024-11-08",
  total: 191,
  images: { logo: "https://images.pokemontcg.io/sv8/logo.png", symbol: "https://images.pokemontcg.io/sv8/symbol.png" },
};

const sampleCard = {
  id: "sv8-25",
  name: "Pikachu",
  number: "25",
  rarity: "Uncommon",
  supertype: "Pokemon",
  subtypes: ["Basic"],
  set: { id: "sv8" },
  images: { small: "https://images.pokemontcg.io/sv8/25.png", large: "https://images.pokemontcg.io/sv8/25_hires.png" },
  tcgplayer: {
    prices: {
      normal: { low: 0.05, mid: 0.15, market: 0.1 },
      reverseHolofoil: { low: 0.1, mid: 0.25, market: 0.2 },
    },
  },
};

describe("pokemonTcgAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POKEMON_TCG_API_KEY;
  });

  afterEach(() => {
    delete process.env.POKEMON_TCG_API_KEY;
  });

  describe("fetchSets", () => {
    it("should fetch and map sets correctly", async () => {
      mockFetch.mockResolvedValue(createSetResponse([sampleSet]));

      const sets = await pokemonTcgAdapter.fetchSets();

      expect(sets).toHaveLength(1);
      expect(sets[0]).toEqual({
        id: "sv8",
        name: "Surging Sparks",
        releaseDate: "2024-11-08",
        totalCards: 191,
        logoUrl: "https://images.pokemontcg.io/sv8/logo.png",
      });
    });

    it("should construct URL with correct ordering and page size", async () => {
      mockFetch.mockResolvedValue(createSetResponse([]));

      await pokemonTcgAdapter.fetchSets();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&pageSize=5",
        { headers: {} }
      );
    });

    it("should include API key header when env var is set", async () => {
      process.env.POKEMON_TCG_API_KEY = "test-key-123";
      mockFetch.mockResolvedValue(createSetResponse([]));

      await pokemonTcgAdapter.fetchSets();

      expect(mockFetch).toHaveBeenCalledWith(expect.any(String), {
        headers: { "X-Api-Key": "test-key-123" },
      });
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });

      await expect(pokemonTcgAdapter.fetchSets()).rejects.toThrow("Pokemon TCG API error fetching sets: 500");
    });
  });

  describe("fetchCards", () => {
    it("should fetch and map cards correctly", async () => {
      mockFetch.mockResolvedValue(createCardResponse([sampleCard]));

      const cards = await pokemonTcgAdapter.fetchCards("sv8");

      expect(cards).toHaveLength(1);
      expect(cards[0]).toEqual({
        id: "sv8-25",
        name: "Pikachu",
        setId: "sv8",
        number: "25",
        rarity: "Uncommon",
        imageUrl: "https://images.pokemontcg.io/sv8/25.png",
        imageUrlHiRes: "https://images.pokemontcg.io/sv8/25_hires.png",
        supertype: "Pokemon",
        subtypes: ["Basic"],
        marketPrice: 0.2, // reverseHolofoil.market (higher priority than normal)
      });
    });

    it("should construct URL with set query", async () => {
      mockFetch.mockResolvedValue(createCardResponse([]));

      await pokemonTcgAdapter.fetchCards("base1");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.pokemontcg.io/v2/cards?q=set.id:base1&pageSize=250&page=1",
        { headers: {} }
      );
    });

    it("should paginate through all cards", async () => {
      const page1Cards = Array.from({ length: 250 }, (_, i) => ({
        ...sampleCard,
        id: `sv8-${i + 1}`,
        number: `${i + 1}`,
      }));
      const page2Cards = [{ ...sampleCard, id: "sv8-251", number: "251" }];

      mockFetch
        .mockResolvedValueOnce(createCardResponse(page1Cards, 1, 251))
        .mockResolvedValueOnce(createCardResponse(page2Cards, 2, 251));

      const cards = await pokemonTcgAdapter.fetchCards("sv8");

      expect(cards).toHaveLength(251);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });

      await expect(pokemonTcgAdapter.fetchCards("sv8")).rejects.toThrow(
        "Pokemon TCG API error fetching cards for set sv8: 429"
      );
    });
  });
});

describe("extractMarketPrice", () => {
  it("should prioritize holofoil", () => {
    expect(
      extractMarketPrice({
        holofoil: { market: 5.0 },
        normal: { market: 0.5 },
      })
    ).toBe(5.0);
  });

  it("should fall back to reverseHolofoil", () => {
    expect(
      extractMarketPrice({
        reverseHolofoil: { market: 1.5 },
        normal: { market: 0.5 },
      })
    ).toBe(1.5);
  });

  it("should fall back to normal", () => {
    expect(extractMarketPrice({ normal: { market: 0.25 } })).toBe(0.25);
  });

  it("should fall back to any variant with market price", () => {
    expect(extractMarketPrice({ unlimitedHolofoil: { market: 3.0 } })).toBe(3.0);
  });

  it("should return undefined when no market prices exist", () => {
    expect(extractMarketPrice({ normal: { low: 0.1, mid: 0.2 } })).toBeUndefined();
  });

  it("should return undefined for undefined input", () => {
    expect(extractMarketPrice(undefined)).toBeUndefined();
  });
});
