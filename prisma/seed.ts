import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // --- Cleanup stale data from previous seeds ---
  // Delete cards not in current seed, then orphaned sets/games
  const seedCardIds = [
    "sv03.5-001", "sv03.5-004", "sv03.5-006", "sv03.5-007", "sv03.5-025", "sv03.5-094", "sv03.5-133", "sv03.5-150",
    "base1-4", "base1-2", "base1-15", "base1-58",
  ];
  const seedSetIds = ["sv03.5", "base1"];
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
  // sv03.5 = Pokemon 151 (TCGdex ID; cards follow National Pokedex order)
  // base1 = Original Base Set (iconic classic cards)
  const pokemonSets = [
    { id: "sv03.5", name: "151", releaseDate: "2023-09-22", totalCards: 207, logoUrl: "https://assets.tcgdex.net/en/sv/sv03.5/logo.png" },
    { id: "base1", name: "Base Set", releaseDate: "1999-01-09", totalCards: 102, logoUrl: "https://assets.tcgdex.net/en/base/base1/logo.png" },
  ];

  for (const set of pokemonSets) {
    await prisma.cardSet.upsert({
      where: { id: set.id },
      create: { ...set, gameId: "pokemon", releaseDate: new Date(set.releaseDate) },
      update: { name: set.name, releaseDate: new Date(set.releaseDate), totalCards: set.totalCards, logoUrl: set.logoUrl },
    });
  }

  console.log("  Sets: 2");

  // --- Pokemon Cards ---
  // sv03.5 (Pokemon 151): card numbers = National Pokedex numbers, so images are guaranteed correct
  const pokemonCards = [
    { id: "sv03.5-001", name: "Bulbasaur", setId: "sv03.5", number: "001", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/001/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/001/high.webp" },
    { id: "sv03.5-004", name: "Charmander", setId: "sv03.5", number: "004", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/004/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/004/high.webp" },
    { id: "sv03.5-006", name: "Charizard ex", setId: "sv03.5", number: "006", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 2", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/006/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/006/high.webp" },
    { id: "sv03.5-007", name: "Squirtle", setId: "sv03.5", number: "007", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/007/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/007/high.webp" },
    { id: "sv03.5-025", name: "Pikachu", setId: "sv03.5", number: "025", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/025/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/025/high.webp" },
    { id: "sv03.5-094", name: "Gengar", setId: "sv03.5", number: "094", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/094/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/094/high.webp" },
    { id: "sv03.5-133", name: "Eevee", setId: "sv03.5", number: "133", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/133/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/133/high.webp" },
    { id: "sv03.5-150", name: "Mewtwo ex", setId: "sv03.5", number: "150", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], imageUrl: "https://assets.tcgdex.net/en/sv/sv03.5/150/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/sv/sv03.5/150/high.webp" },
    // base1 (Original Base Set): well-known card-to-number mapping
    { id: "base1-4", name: "Charizard", setId: "base1", number: "4", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/4/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/4/high.webp" },
    { id: "base1-2", name: "Blastoise", setId: "base1", number: "2", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/2/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/2/high.webp" },
    { id: "base1-15", name: "Venusaur", setId: "base1", number: "15", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/15/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/15/high.webp" },
    { id: "base1-58", name: "Pikachu", setId: "base1", number: "58", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/58/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/58/high.webp" },
  ];

  const allCards = pokemonCards;

  for (const card of allCards) {
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
  console.log(`  Cards: ${allCards.length}`);

  console.log("Seed complete!");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
