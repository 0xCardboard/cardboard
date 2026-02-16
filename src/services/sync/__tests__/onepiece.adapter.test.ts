import { describe, it, expect, vi, beforeEach } from "vitest";
import { onepieceAdapter } from "../onepiece.adapter";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const sampleSets = [
  { set_id: "OP01", set_name: "Romance Dawn", release_date: "2022-07-22", total_cards: 121 },
  { set_id: "OP02", set_name: "Paramount War", release_date: "2022-11-04", total_cards: 121 },
  { set_id: "OP03", set_name: "Pillars of Strength", release_date: "2023-03-10", total_cards: 122 },
  { set_id: "OP04", set_name: "Kingdoms of Intrigue", release_date: "2023-06-30", total_cards: 122 },
  { set_id: "OP05", set_name: "Awakening of the New Era", release_date: "2023-08-25", total_cards: 122 },
  { set_id: "OP06", set_name: "Wings of the Captain", release_date: "2023-11-10", total_cards: 128 },
];

const sampleCards = [
  {
    card_id: "OP01-001",
    card_name: "Monkey D. Luffy",
    card_number: "001",
    rarity: "SR",
    card_type: "Leader",
    card_image: "https://optcgapi.com/images/OP01-001.png",
    market_price: 5.5,
  },
  {
    card_id: "OP01-002",
    card_name: "Roronoa Zoro",
    card_number: "002",
    rarity: "R",
    card_type: "Character",
    card_image: "https://optcgapi.com/images/OP01-002.png",
    market_price: 2.0,
  },
];

describe("onepieceAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchSets", () => {
    it("should fetch and map sets, returning most recent 5", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleSets),
      });

      const sets = await onepieceAdapter.fetchSets();

      expect(sets).toHaveLength(5);
      // Should be sorted by ID descending (most recent first)
      expect(sets[0].id).toBe("OP06");
      expect(sets[0].name).toBe("Wings of the Captain");
      expect(sets[0].totalCards).toBe(128);
    });

    it("should handle nested data response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: sampleSets.slice(0, 2) }),
      });

      const sets = await onepieceAdapter.fetchSets();

      expect(sets).toHaveLength(2);
    });

    it("should return empty array on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: "Server Error" });

      const sets = await onepieceAdapter.fetchSets();

      expect(sets).toEqual([]);
    });

    it("should return empty array on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const sets = await onepieceAdapter.fetchSets();

      expect(sets).toEqual([]);
    });
  });

  describe("fetchCards", () => {
    it("should fetch and map cards correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(sampleCards),
      });

      const cards = await onepieceAdapter.fetchCards("OP01");

      expect(cards).toHaveLength(2);
      expect(cards[0]).toEqual({
        id: "OP01-001",
        name: "Monkey D. Luffy",
        setId: "OP01",
        number: "001",
        rarity: "SR",
        imageUrl: "https://optcgapi.com/images/OP01-001.png",
        imageUrlHiRes: undefined,
        supertype: "Leader",
        subtypes: undefined,
        marketPrice: 5.5,
      });
    });

    it("should return empty array on API error", async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

      const cards = await onepieceAdapter.fetchCards("OP99");

      expect(cards).toEqual([]);
    });

    it("should return empty array on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("fetch failed"));

      const cards = await onepieceAdapter.fetchCards("OP01");

      expect(cards).toEqual([]);
    });
  });
});
