import { describe, it, expect, vi, beforeEach } from "vitest";
import { pokemonTcgAdapter } from "../pokemon-tcg.adapter";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sampleSetBrief = {
  id: "sv8",
  name: "Surging Sparks",
  logo: "https://assets.tcgdex.net/en/sv/sv8/logo",
  cardCount: { total: 191, official: 191 },
};

const sampleSetDetail = {
  id: "sv8",
  name: "Surging Sparks",
  logo: "https://assets.tcgdex.net/en/sv/sv8/logo",
  releaseDate: "2024-11-08",
  cardCount: { total: 191, official: 191 },
  cards: [
    {
      id: "25",
      localId: "25",
      name: "Pikachu",
      image: "https://assets.tcgdex.net/en/sv/sv8/25",
    },
    {
      id: "4",
      localId: "4",
      name: "Charmander",
      image: "https://assets.tcgdex.net/en/sv/sv8/4",
    },
  ],
};

describe("pokemonTcgAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSets", () => {
    it("should fetch and map sets correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([sampleSetBrief]),
      });

      const sets = await pokemonTcgAdapter.fetchSets();

      expect(sets).toHaveLength(1);
      expect(sets[0]).toEqual({
        id: "sv8",
        name: "Surging Sparks",
        totalCards: 191,
        logoUrl: "https://assets.tcgdex.net/en/sv/sv8/logo.png",
      });
    });

    it("should call the correct TCGdex endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await pokemonTcgAdapter.fetchSets();

      expect(mockFetch).toHaveBeenCalledWith("https://api.tcgdex.net/v2/en/sets");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Internal Server Error" });

      await expect(pokemonTcgAdapter.fetchSets()).rejects.toThrow("TCGdex API error fetching sets: 500");
    });
  });

  describe("fetchCards", () => {
    it("should fetch set detail and map cards with image URLs", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleSetDetail),
      });

      const cards = await pokemonTcgAdapter.fetchCards("sv8");

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({
        id: "sv8-25",
        name: "Pikachu",
        setId: "sv8",
        number: "25",
        imageUrl: "https://assets.tcgdex.net/en/sv/sv8/25/low.webp",
        imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv8/25/high.webp",
      });
    });

    it("should call the correct TCGdex set endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...sampleSetDetail, cards: [] }),
      });

      await pokemonTcgAdapter.fetchCards("base1");

      expect(mockFetch).toHaveBeenCalledWith("https://api.tcgdex.net/v2/en/sets/base1");
    });

    it("should handle cards with no image", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ...sampleSetDetail,
            cards: [{ id: "1", localId: "1", name: "No Image Card" }],
          }),
      });

      const cards = await pokemonTcgAdapter.fetchCards("sv8");

      expect(cards[0].imageUrl).toBeUndefined();
      expect(cards[0].imageUrlHiRes).toBeUndefined();
    });

    it("should handle empty cards array", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ...sampleSetDetail, cards: undefined }),
      });

      const cards = await pokemonTcgAdapter.fetchCards("sv8");

      expect(cards).toHaveLength(0);
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 429, statusText: "Too Many Requests" });

      await expect(pokemonTcgAdapter.fetchCards("sv8")).rejects.toThrow(
        "TCGdex API error fetching cards for set sv8: 429"
      );
    });
  });
});
