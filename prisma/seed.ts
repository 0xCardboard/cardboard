import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // --- Cleanup stale data from previous seeds ---
  const seedCardIds = [
    // base1 (Base Set — all 102 cards)
    ...Array.from({ length: 102 }, (_, i) => `base1-${i + 1}`),
    // swsh7 (Evolving Skies)
    "swsh7-74", "swsh7-75", "swsh7-110", "swsh7-111", "swsh7-215",
    // swsh9 (Brilliant Stars)
    "swsh9-018",
    // sv03.5 (Pokemon 151)
    "sv03.5-001", "sv03.5-004", "sv03.5-006", "sv03.5-007", "sv03.5-025", "sv03.5-094", "sv03.5-133", "sv03.5-150",
    // sv01 (Scarlet & Violet)
    "sv01-254",
    // sv04.5 (Paldean Fates)
    "sv04.5-218",
    // sv08 (Surging Sparks)
    "sv08-197",
    // sv08.5 (Prismatic Evolutions)
    "sv08.5-030",
  ];
  const seedSetIds = ["base1", "swsh7", "swsh9", "sv03.5", "sv01", "sv04.5", "sv08", "sv08.5"];
  const seedGameIds = ["pokemon"];

  const deletedCards = await prisma.card.deleteMany({ where: { id: { notIn: seedCardIds } } });
  const deletedSets = await prisma.cardSet.deleteMany({ where: { id: { notIn: seedSetIds } } });
  const deletedGames = await prisma.tcgGame.deleteMany({ where: { id: { notIn: seedGameIds } } });
  if (deletedCards.count || deletedSets.count || deletedGames.count) {
    console.log(`  Cleanup: removed ${deletedCards.count} cards, ${deletedSets.count} sets, ${deletedGames.count} games`);
  }

  // --- Games ---
  await prisma.tcgGame.upsert({
    where: { id: "pokemon" },
    create: { id: "pokemon", name: "Pokemon TCG" },
    update: { name: "Pokemon TCG" },
  });
  console.log("  Games: 1");

  // --- Pokemon Sets ---
  const pokemonSets = [
    { id: "base1", name: "Base Set", releaseDate: "1999-01-09", totalCards: 102, logoUrl: "https://assets.tcgdex.net/en/base/base1/logo.png" },
    { id: "swsh7", name: "Evolving Skies", releaseDate: "2021-08-27", totalCards: 237, logoUrl: "https://assets.tcgdex.net/en/swsh/swsh7/logo.png" },
    { id: "swsh9", name: "Brilliant Stars", releaseDate: "2022-02-25", totalCards: 186, logoUrl: "https://assets.tcgdex.net/en/swsh/swsh9/logo.png" },
    { id: "sv01", name: "Scarlet & Violet", releaseDate: "2023-03-31", totalCards: 258, logoUrl: "https://assets.tcgdex.net/en/sv/sv01/logo.png" },
    { id: "sv03.5", name: "151", releaseDate: "2023-09-22", totalCards: 207, logoUrl: "https://assets.tcgdex.net/en/sv/sv03.5/logo.png" },
    { id: "sv04.5", name: "Paldean Fates", releaseDate: "2024-01-26", totalCards: 245, logoUrl: "https://assets.tcgdex.net/en/sv/sv04.5/logo.png" },
    { id: "sv08", name: "Surging Sparks", releaseDate: "2024-11-08", totalCards: 252, logoUrl: "https://assets.tcgdex.net/en/sv/sv08/logo.png" },
    { id: "sv08.5", name: "Prismatic Evolutions", releaseDate: "2025-01-17", totalCards: 180, logoUrl: "https://assets.tcgdex.net/en/sv/sv08.5/logo.png" },
  ];

  for (const set of pokemonSets) {
    await prisma.cardSet.upsert({
      where: { id: set.id },
      create: { ...set, gameId: "pokemon", releaseDate: new Date(set.releaseDate) },
      update: { name: set.name, releaseDate: new Date(set.releaseDate), totalCards: set.totalCards, logoUrl: set.logoUrl },
    });
  }
  console.log(`  Sets: ${pokemonSets.length}`);

  // --- Pokemon Cards ---
  const pokemonCards = [
    // ==========================================================================
    // base1 (Base Set — complete 102/102, 1st Edition) — localIds NOT zero-padded
    // Source: https://github.com/tcgdex/cards-database (data/Base/Base Set/)
    // ==========================================================================

    // Rare Holo Pokemon (1–16)
    { id: "base1-1", name: "Alakazam", setId: "base1", number: "1", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/1/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/1/high.webp" },
    { id: "base1-2", name: "Blastoise", setId: "base1", number: "2", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/2/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/2/high.webp" },
    { id: "base1-3", name: "Chansey", setId: "base1", number: "3", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/3/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/3/high.webp" },
    { id: "base1-4", name: "Charizard", setId: "base1", number: "4", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/4/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/4/high.webp" },
    { id: "base1-5", name: "Clefairy", setId: "base1", number: "5", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/5/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/5/high.webp" },
    { id: "base1-6", name: "Gyarados", setId: "base1", number: "6", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/6/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/6/high.webp" },
    { id: "base1-7", name: "Hitmonchan", setId: "base1", number: "7", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/7/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/7/high.webp" },
    { id: "base1-8", name: "Machamp", setId: "base1", number: "8", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/8/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/8/high.webp" },
    { id: "base1-9", name: "Magneton", setId: "base1", number: "9", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/9/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/9/high.webp" },
    { id: "base1-10", name: "Mewtwo", setId: "base1", number: "10", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/10/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/10/high.webp" },
    { id: "base1-11", name: "Nidoking", setId: "base1", number: "11", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/11/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/11/high.webp" },
    { id: "base1-12", name: "Ninetales", setId: "base1", number: "12", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/12/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/12/high.webp" },
    { id: "base1-13", name: "Poliwrath", setId: "base1", number: "13", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/13/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/13/high.webp" },
    { id: "base1-14", name: "Raichu", setId: "base1", number: "14", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/14/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/14/high.webp" },
    { id: "base1-15", name: "Venusaur", setId: "base1", number: "15", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/15/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/15/high.webp" },
    { id: "base1-16", name: "Zapdos", setId: "base1", number: "16", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/16/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/16/high.webp" },

    // Rare Pokemon (17–22)
    { id: "base1-17", name: "Beedrill", setId: "base1", number: "17", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/17/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/17/high.webp" },
    { id: "base1-18", name: "Dragonair", setId: "base1", number: "18", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/18/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/18/high.webp" },
    { id: "base1-19", name: "Dugtrio", setId: "base1", number: "19", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/19/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/19/high.webp" },
    { id: "base1-20", name: "Electabuzz", setId: "base1", number: "20", rarity: "Rare", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/20/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/20/high.webp" },
    { id: "base1-21", name: "Electrode", setId: "base1", number: "21", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/21/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/21/high.webp" },
    { id: "base1-22", name: "Pidgeotto", setId: "base1", number: "22", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/22/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/22/high.webp" },

    // Uncommon Pokemon (23–42)
    { id: "base1-23", name: "Arcanine", setId: "base1", number: "23", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/23/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/23/high.webp" },
    { id: "base1-24", name: "Charmeleon", setId: "base1", number: "24", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/24/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/24/high.webp" },
    { id: "base1-25", name: "Dewgong", setId: "base1", number: "25", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/25/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/25/high.webp" },
    { id: "base1-26", name: "Dratini", setId: "base1", number: "26", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/26/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/26/high.webp" },
    { id: "base1-27", name: "Farfetch'd", setId: "base1", number: "27", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/27/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/27/high.webp" },
    { id: "base1-28", name: "Growlithe", setId: "base1", number: "28", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/28/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/28/high.webp" },
    { id: "base1-29", name: "Haunter", setId: "base1", number: "29", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/29/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/29/high.webp" },
    { id: "base1-30", name: "Ivysaur", setId: "base1", number: "30", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/30/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/30/high.webp" },
    { id: "base1-31", name: "Jynx", setId: "base1", number: "31", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/31/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/31/high.webp" },
    { id: "base1-32", name: "Kadabra", setId: "base1", number: "32", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/32/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/32/high.webp" },
    { id: "base1-33", name: "Kakuna", setId: "base1", number: "33", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/33/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/33/high.webp" },
    { id: "base1-34", name: "Machoke", setId: "base1", number: "34", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/34/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/34/high.webp" },
    { id: "base1-35", name: "Magikarp", setId: "base1", number: "35", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/35/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/35/high.webp" },
    { id: "base1-36", name: "Magmar", setId: "base1", number: "36", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/36/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/36/high.webp" },
    { id: "base1-37", name: "Nidorino", setId: "base1", number: "37", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/37/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/37/high.webp" },
    { id: "base1-38", name: "Poliwhirl", setId: "base1", number: "38", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/38/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/38/high.webp" },
    { id: "base1-39", name: "Porygon", setId: "base1", number: "39", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/39/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/39/high.webp" },
    { id: "base1-40", name: "Raticate", setId: "base1", number: "40", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/40/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/40/high.webp" },
    { id: "base1-41", name: "Seel", setId: "base1", number: "41", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/41/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/41/high.webp" },
    { id: "base1-42", name: "Wartortle", setId: "base1", number: "42", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/42/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/42/high.webp" },

    // Common Pokemon (43–69)
    { id: "base1-43", name: "Abra", setId: "base1", number: "43", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/43/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/43/high.webp" },
    { id: "base1-44", name: "Bulbasaur", setId: "base1", number: "44", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/44/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/44/high.webp" },
    { id: "base1-45", name: "Caterpie", setId: "base1", number: "45", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/45/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/45/high.webp" },
    { id: "base1-46", name: "Charmander", setId: "base1", number: "46", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/46/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/46/high.webp" },
    { id: "base1-47", name: "Diglett", setId: "base1", number: "47", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/47/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/47/high.webp" },
    { id: "base1-48", name: "Doduo", setId: "base1", number: "48", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/48/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/48/high.webp" },
    { id: "base1-49", name: "Drowzee", setId: "base1", number: "49", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/49/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/49/high.webp" },
    { id: "base1-50", name: "Gastly", setId: "base1", number: "50", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/50/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/50/high.webp" },
    { id: "base1-51", name: "Koffing", setId: "base1", number: "51", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/51/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/51/high.webp" },
    { id: "base1-52", name: "Machop", setId: "base1", number: "52", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/52/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/52/high.webp" },
    { id: "base1-53", name: "Magnemite", setId: "base1", number: "53", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/53/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/53/high.webp" },
    { id: "base1-54", name: "Metapod", setId: "base1", number: "54", rarity: "Common", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/54/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/54/high.webp" },
    { id: "base1-55", name: "Nidoran\u2642", setId: "base1", number: "55", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/55/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/55/high.webp" },
    { id: "base1-56", name: "Onix", setId: "base1", number: "56", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/56/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/56/high.webp" },
    { id: "base1-57", name: "Pidgey", setId: "base1", number: "57", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/57/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/57/high.webp" },
    { id: "base1-58", name: "Pikachu", setId: "base1", number: "58", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/58/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/58/high.webp" },
    { id: "base1-59", name: "Poliwag", setId: "base1", number: "59", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/59/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/59/high.webp" },
    { id: "base1-60", name: "Ponyta", setId: "base1", number: "60", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/60/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/60/high.webp" },
    { id: "base1-61", name: "Rattata", setId: "base1", number: "61", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/61/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/61/high.webp" },
    { id: "base1-62", name: "Sandshrew", setId: "base1", number: "62", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/62/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/62/high.webp" },
    { id: "base1-63", name: "Squirtle", setId: "base1", number: "63", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/63/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/63/high.webp" },
    { id: "base1-64", name: "Starmie", setId: "base1", number: "64", rarity: "Common", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/base/base1/64/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/64/high.webp" },
    { id: "base1-65", name: "Staryu", setId: "base1", number: "65", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/65/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/65/high.webp" },
    { id: "base1-66", name: "Tangela", setId: "base1", number: "66", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/66/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/66/high.webp" },
    { id: "base1-67", name: "Voltorb", setId: "base1", number: "67", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/67/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/67/high.webp" },
    { id: "base1-68", name: "Vulpix", setId: "base1", number: "68", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/68/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/68/high.webp" },
    { id: "base1-69", name: "Weedle", setId: "base1", number: "69", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/69/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/69/high.webp" },

    // Rare Trainers (70–79)
    { id: "base1-70", name: "Clefairy Doll", setId: "base1", number: "70", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/70/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/70/high.webp" },
    { id: "base1-71", name: "Computer Search", setId: "base1", number: "71", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/71/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/71/high.webp" },
    { id: "base1-72", name: "Devolution Spray", setId: "base1", number: "72", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/72/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/72/high.webp" },
    { id: "base1-73", name: "Impostor Professor Oak", setId: "base1", number: "73", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/73/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/73/high.webp" },
    { id: "base1-74", name: "Item Finder", setId: "base1", number: "74", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/74/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/74/high.webp" },
    { id: "base1-75", name: "Lass", setId: "base1", number: "75", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/75/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/75/high.webp" },
    { id: "base1-76", name: "Pok\u00e9mon Breeder", setId: "base1", number: "76", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/76/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/76/high.webp" },
    { id: "base1-77", name: "Pok\u00e9mon Trader", setId: "base1", number: "77", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/77/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/77/high.webp" },
    { id: "base1-78", name: "Scoop Up", setId: "base1", number: "78", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/78/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/78/high.webp" },
    { id: "base1-79", name: "Super Energy Removal", setId: "base1", number: "79", rarity: "Rare", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/79/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/79/high.webp" },

    // Uncommon Trainers (80–90)
    { id: "base1-80", name: "Defender", setId: "base1", number: "80", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/80/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/80/high.webp" },
    { id: "base1-81", name: "Energy Retrieval", setId: "base1", number: "81", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/81/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/81/high.webp" },
    { id: "base1-82", name: "Full Heal", setId: "base1", number: "82", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/82/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/82/high.webp" },
    { id: "base1-83", name: "Maintenance", setId: "base1", number: "83", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/83/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/83/high.webp" },
    { id: "base1-84", name: "PlusPower", setId: "base1", number: "84", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/84/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/84/high.webp" },
    { id: "base1-85", name: "Pok\u00e9mon Center", setId: "base1", number: "85", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/85/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/85/high.webp" },
    { id: "base1-86", name: "Pok\u00e9mon Flute", setId: "base1", number: "86", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/86/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/86/high.webp" },
    { id: "base1-87", name: "Pok\u00e9dex", setId: "base1", number: "87", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/87/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/87/high.webp" },
    { id: "base1-88", name: "Professor Oak", setId: "base1", number: "88", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/88/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/88/high.webp" },
    { id: "base1-89", name: "Revive", setId: "base1", number: "89", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/89/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/89/high.webp" },
    { id: "base1-90", name: "Super Potion", setId: "base1", number: "90", rarity: "Uncommon", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/90/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/90/high.webp" },

    // Common Trainers (91–95)
    { id: "base1-91", name: "Bill", setId: "base1", number: "91", rarity: "Common", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/91/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/91/high.webp" },
    { id: "base1-92", name: "Energy Removal", setId: "base1", number: "92", rarity: "Common", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/92/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/92/high.webp" },
    { id: "base1-93", name: "Gust of Wind", setId: "base1", number: "93", rarity: "Common", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/93/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/93/high.webp" },
    { id: "base1-94", name: "Potion", setId: "base1", number: "94", rarity: "Common", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/94/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/94/high.webp" },
    { id: "base1-95", name: "Switch", setId: "base1", number: "95", rarity: "Common", supertype: "Trainer", subtypes: [], imageUrl: "https://assets.tcgdex.net/en/base/base1/95/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/95/high.webp" },

    // Special Energy (96)
    { id: "base1-96", name: "Double Colorless Energy", setId: "base1", number: "96", rarity: "Uncommon", supertype: "Energy", subtypes: ["Special"], imageUrl: "https://assets.tcgdex.net/en/base/base1/96/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/96/high.webp" },

    // Basic Energy (97–102)
    { id: "base1-97", name: "Fighting Energy", setId: "base1", number: "97", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/97/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/97/high.webp" },
    { id: "base1-98", name: "Fire Energy", setId: "base1", number: "98", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/98/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/98/high.webp" },
    { id: "base1-99", name: "Grass Energy", setId: "base1", number: "99", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/99/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/99/high.webp" },
    { id: "base1-100", name: "Lightning Energy", setId: "base1", number: "100", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/100/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/100/high.webp" },
    { id: "base1-101", name: "Psychic Energy", setId: "base1", number: "101", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/101/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/101/high.webp" },
    { id: "base1-102", name: "Water Energy", setId: "base1", number: "102", rarity: "Common", supertype: "Energy", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/102/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/102/high.webp" },

    // swsh7 (Evolving Skies) — localIds NOT zero-padded
    { id: "swsh7-74", name: "Sylveon V", setId: "swsh7", number: "74", rarity: "Holo Rare V", supertype: "Pokemon", subtypes: ["Basic", "V"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh7/74/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh7/74/high.webp" },
    { id: "swsh7-75", name: "Sylveon VMAX", setId: "swsh7", number: "75", rarity: "Holo Rare VMAX", supertype: "Pokemon", subtypes: ["VMAX"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh7/75/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh7/75/high.webp" },
    { id: "swsh7-110", name: "Rayquaza V", setId: "swsh7", number: "110", rarity: "Holo Rare V", supertype: "Pokemon", subtypes: ["Basic", "V"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh7/110/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh7/110/high.webp" },
    { id: "swsh7-111", name: "Rayquaza VMAX", setId: "swsh7", number: "111", rarity: "Holo Rare VMAX", supertype: "Pokemon", subtypes: ["VMAX"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh7/111/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh7/111/high.webp" },
    { id: "swsh7-215", name: "Umbreon VMAX", setId: "swsh7", number: "215", rarity: "Secret Rare", supertype: "Pokemon", subtypes: ["VMAX"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh7/215/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh7/215/high.webp" },

    // swsh9 (Brilliant Stars) — localIds ZERO-padded
    { id: "swsh9-018", name: "Charizard VSTAR", setId: "swsh9", number: "018", rarity: "Holo Rare VSTAR", supertype: "Pokemon", subtypes: ["VSTAR"], imageUrl: "https://assets.tcgdex.net/en/swsh/swsh9/018/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/swsh/swsh9/018/high.webp" },

    // sv01 (Scarlet & Violet) — localIds ZERO-padded
    { id: "sv01-254", name: "Koraidon ex", setId: "sv01", number: "254", rarity: "Hyper Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv01/254/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv01/254/high.webp" },

    // sv03.5 (Pokemon 151) — localIds ZERO-padded
    { id: "sv03.5-001", name: "Bulbasaur", setId: "sv03.5", number: "001", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/001/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/001/high.webp" },
    { id: "sv03.5-004", name: "Charmander", setId: "sv03.5", number: "004", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/004/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/004/high.webp" },
    { id: "sv03.5-006", name: "Charizard ex", setId: "sv03.5", number: "006", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 2", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/006/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/006/high.webp" },
    { id: "sv03.5-007", name: "Squirtle", setId: "sv03.5", number: "007", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/007/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/007/high.webp" },
    { id: "sv03.5-025", name: "Pikachu", setId: "sv03.5", number: "025", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/025/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/025/high.webp" },
    { id: "sv03.5-094", name: "Gengar", setId: "sv03.5", number: "094", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/094/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/094/high.webp" },
    { id: "sv03.5-133", name: "Eevee", setId: "sv03.5", number: "133", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/133/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/133/high.webp" },
    { id: "sv03.5-150", name: "Mewtwo ex", setId: "sv03.5", number: "150", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/150/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/150/high.webp" },

    // sv04.5 (Paldean Fates) — localIds ZERO-padded
    { id: "sv04.5-218", name: "Glimmora ex", setId: "sv04.5", number: "218", rarity: "Shiny Ultra Rare", supertype: "Pokemon", subtypes: ["Stage 1", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv04.5/218/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv04.5/218/high.webp" },

    // sv08 (Surging Sparks) — localIds ZERO-padded
    { id: "sv08-197", name: "Ceruledge", setId: "sv08", number: "197", rarity: "Illustration Rare", supertype: "Pokemon", subtypes: ["Stage 1"], imageUrl: "https://assets.tcgdex.net/en/sv/sv08/197/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv08/197/high.webp" },

    // sv08.5 (Prismatic Evolutions) — localIds ZERO-padded
    { id: "sv08.5-030", name: "Jolteon ex", setId: "sv08.5", number: "030", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 1", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv08.5/030/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv08.5/030/high.webp" },
  ];

  for (const card of pokemonCards) {
    await prisma.card.upsert({
      where: { id: card.id },
      create: {
        id: card.id,
        name: card.name,
        setId: card.setId,
        number: card.number,
        rarity: card.rarity,
        supertype: card.supertype,
        subtypes: card.subtypes,
        imageUrl: card.imageUrl,
        imageUrlHiRes: card.imageUrlHiRes,
      },
      update: {
        name: card.name,
        rarity: card.rarity,
        imageUrl: card.imageUrl,
        imageUrlHiRes: card.imageUrlHiRes,
      },
    });
  }
  console.log(`  Cards: ${pokemonCards.length}`);

  console.log("Seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
