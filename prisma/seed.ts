import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // --- Games ---
  await prisma.tcgGame.upsert({
    where: { id: "pokemon" },
    create: { id: "pokemon", name: "Pokemon TCG" },
    update: { name: "Pokemon TCG" },
  });
  await prisma.tcgGame.upsert({
    where: { id: "onepiece" },
    create: { id: "onepiece", name: "One Piece TCG" },
    update: { name: "One Piece TCG" },
  });
  console.log("  Games: 2");

  // --- Pokemon Sets ---
  // sv3pt5 = Pokemon 151 (cards follow National Pokedex order, so name-to-number mapping is guaranteed)
  // base1 = Original Base Set (iconic classic cards)
  const pokemonSets = [
    { id: "sv3pt5", name: "Pokemon 151", releaseDate: "2023-09-22", totalCards: 207, logoUrl: "https://images.pokemontcg.io/sv3pt5/logo.png" },
    { id: "base1", name: "Base Set", releaseDate: "1999-01-09", totalCards: 102, logoUrl: "https://images.pokemontcg.io/base1/logo.png" },
  ];

  for (const set of pokemonSets) {
    await prisma.cardSet.upsert({
      where: { id: set.id },
      create: { ...set, gameId: "pokemon", releaseDate: new Date(set.releaseDate) },
      update: { name: set.name, releaseDate: new Date(set.releaseDate), totalCards: set.totalCards, logoUrl: set.logoUrl },
    });
  }

  // --- One Piece Sets ---
  const onepieceSets = [
    { id: "OP09", name: "The Four Emperors", releaseDate: "2024-10-25", totalCards: 128 },
    { id: "OP08", name: "Two Legends", releaseDate: "2024-08-09", totalCards: 128 },
    { id: "OP07", name: "500 Years in the Future", releaseDate: "2024-06-28", totalCards: 128 },
  ];

  for (const set of onepieceSets) {
    await prisma.cardSet.upsert({
      where: { id: set.id },
      create: { ...set, gameId: "onepiece", releaseDate: new Date(set.releaseDate), logoUrl: null },
      update: { name: set.name, releaseDate: new Date(set.releaseDate), totalCards: set.totalCards },
    });
  }
  console.log("  Sets: 5");

  // --- Pokemon Cards ---
  // sv3pt5 (Pokemon 151): card numbers = National Pokedex numbers, so images are guaranteed correct
  const pokemonCards = [
    { id: "sv3pt5-1", name: "Bulbasaur", setId: "sv3pt5", number: "001", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 75, imageUrl: "https://images.pokemontcg.io/sv3pt5/1.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/1_hires.png" },
    { id: "sv3pt5-4", name: "Charmander", setId: "sv3pt5", number: "004", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 95, imageUrl: "https://images.pokemontcg.io/sv3pt5/4.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/4_hires.png" },
    { id: "sv3pt5-6", name: "Charizard ex", setId: "sv3pt5", number: "006", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 2", "ex"], marketPrice: 2500, imageUrl: "https://images.pokemontcg.io/sv3pt5/6.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/6_hires.png" },
    { id: "sv3pt5-7", name: "Squirtle", setId: "sv3pt5", number: "007", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 65, imageUrl: "https://images.pokemontcg.io/sv3pt5/7.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/7_hires.png" },
    { id: "sv3pt5-25", name: "Pikachu", setId: "sv3pt5", number: "025", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 150, imageUrl: "https://images.pokemontcg.io/sv3pt5/25.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/25_hires.png" },
    { id: "sv3pt5-94", name: "Gengar", setId: "sv3pt5", number: "094", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Stage 2"], marketPrice: 125, imageUrl: "https://images.pokemontcg.io/sv3pt5/94.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/94_hires.png" },
    { id: "sv3pt5-133", name: "Eevee", setId: "sv3pt5", number: "133", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 110, imageUrl: "https://images.pokemontcg.io/sv3pt5/133.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/133_hires.png" },
    { id: "sv3pt5-150", name: "Mewtwo ex", setId: "sv3pt5", number: "150", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], marketPrice: 1800, imageUrl: "https://images.pokemontcg.io/sv3pt5/150.png", imageUrlHiRes: "https://images.pokemontcg.io/sv3pt5/150_hires.png" },
    // base1 (Original Base Set): well-known card-to-number mapping
    { id: "base1-4", name: "Charizard", setId: "base1", number: "4", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], marketPrice: 35000, imageUrl: "https://images.pokemontcg.io/base1/4.png", imageUrlHiRes: "https://images.pokemontcg.io/base1/4_hires.png" },
    { id: "base1-2", name: "Blastoise", setId: "base1", number: "2", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], marketPrice: 8500, imageUrl: "https://images.pokemontcg.io/base1/2.png", imageUrlHiRes: "https://images.pokemontcg.io/base1/2_hires.png" },
    { id: "base1-15", name: "Venusaur", setId: "base1", number: "15", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], marketPrice: 6500, imageUrl: "https://images.pokemontcg.io/base1/15.png", imageUrlHiRes: "https://images.pokemontcg.io/base1/15_hires.png" },
    { id: "base1-58", name: "Pikachu", setId: "base1", number: "58", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 1200, imageUrl: "https://images.pokemontcg.io/base1/58.png", imageUrlHiRes: "https://images.pokemontcg.io/base1/58_hires.png" },
  ];

  // --- One Piece Cards ---
  const onepieceCards = [
    { id: "OP09-001", name: "Monkey D. Luffy", setId: "OP09", number: "001", rarity: "L", supertype: "Leader", subtypes: [] as string[], marketPrice: 550, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP09-025", name: "Roronoa Zoro", setId: "OP09", number: "025", rarity: "SR", supertype: "Character", subtypes: [] as string[], marketPrice: 1800, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP09-050", name: "Nico Robin", setId: "OP09", number: "050", rarity: "R", supertype: "Character", subtypes: [] as string[], marketPrice: 200, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP09-075", name: "Trafalgar Law", setId: "OP09", number: "075", rarity: "SR", supertype: "Character", subtypes: [] as string[], marketPrice: 1500, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP08-001", name: "Shanks", setId: "OP08", number: "001", rarity: "L", supertype: "Leader", subtypes: [] as string[], marketPrice: 480, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP08-030", name: "Portgas D. Ace", setId: "OP08", number: "030", rarity: "SR", supertype: "Character", subtypes: [] as string[], marketPrice: 2200, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP08-060", name: "Nami", setId: "OP08", number: "060", rarity: "R", supertype: "Character", subtypes: [] as string[], marketPrice: 150, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP07-001", name: "Kozuki Oden", setId: "OP07", number: "001", rarity: "L", supertype: "Leader", subtypes: [] as string[], marketPrice: 350, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP07-040", name: "Yamato", setId: "OP07", number: "040", rarity: "SR", supertype: "Character", subtypes: [] as string[], marketPrice: 1200, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
    { id: "OP07-080", name: "Sanji", setId: "OP07", number: "080", rarity: "R", supertype: "Character", subtypes: [] as string[], marketPrice: 180, imageUrl: null as string | null, imageUrlHiRes: null as string | null },
  ];

  const allCards = [...pokemonCards, ...onepieceCards];

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
        marketPrice: card.marketPrice,
        imageUrl: card.imageUrl,
        imageUrlHiRes: card.imageUrlHiRes,
        lastPriceSync: new Date(),
      },
      update: {
        name: card.name,
        rarity: card.rarity,
        marketPrice: card.marketPrice,
        imageUrl: card.imageUrl,
        imageUrlHiRes: card.imageUrlHiRes,
        lastPriceSync: new Date(),
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
