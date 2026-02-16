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
  const pokemonSets = [
    { id: "sv8", name: "Surging Sparks", releaseDate: "2024-11-08", totalCards: 191, logoUrl: "https://images.pokemontcg.io/sv8/logo.png" },
    { id: "sv7", name: "Stellar Crown", releaseDate: "2024-09-13", totalCards: 175, logoUrl: "https://images.pokemontcg.io/sv7/logo.png" },
    { id: "sv6", name: "Twilight Masquerade", releaseDate: "2024-05-24", totalCards: 167, logoUrl: "https://images.pokemontcg.io/sv6/logo.png" },
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
  console.log("  Sets: 6");

  // --- Pokemon Cards ---
  const pokemonCards = [
    { id: "sv8-25", name: "Pikachu", setId: "sv8", number: "025", rarity: "Uncommon", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 15, imageUrl: "https://images.pokemontcg.io/sv8/25.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/25_hires.png" },
    { id: "sv8-6", name: "Charizard ex", setId: "sv8", number: "006", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 2", "ex"], marketPrice: 850, imageUrl: "https://images.pokemontcg.io/sv8/6.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/6_hires.png" },
    { id: "sv8-1", name: "Bulbasaur", setId: "sv8", number: "001", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 8, imageUrl: "https://images.pokemontcg.io/sv8/1.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/1_hires.png" },
    { id: "sv8-4", name: "Charmander", setId: "sv8", number: "004", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 10, imageUrl: "https://images.pokemontcg.io/sv8/4.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/4_hires.png" },
    { id: "sv8-7", name: "Squirtle", setId: "sv8", number: "007", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 8, imageUrl: "https://images.pokemontcg.io/sv8/7.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/7_hires.png" },
    { id: "sv8-150", name: "Mewtwo ex", setId: "sv8", number: "150", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], marketPrice: 1200, imageUrl: "https://images.pokemontcg.io/sv8/150.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/150_hires.png" },
    { id: "sv8-94", name: "Gengar", setId: "sv8", number: "094", rarity: "Rare", supertype: "Pokemon", subtypes: ["Stage 2"], marketPrice: 125, imageUrl: "https://images.pokemontcg.io/sv8/94.png", imageUrlHiRes: "https://images.pokemontcg.io/sv8/94_hires.png" },
    { id: "sv7-1", name: "Terapagos ex", setId: "sv7", number: "001", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], marketPrice: 650, imageUrl: "https://images.pokemontcg.io/sv7/1.png", imageUrlHiRes: "https://images.pokemontcg.io/sv7/1_hires.png" },
    { id: "sv7-25", name: "Eevee", setId: "sv7", number: "025", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], marketPrice: 12, imageUrl: "https://images.pokemontcg.io/sv7/25.png", imageUrlHiRes: "https://images.pokemontcg.io/sv7/25_hires.png" },
    { id: "sv7-50", name: "Sylveon ex", setId: "sv7", number: "050", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 1", "ex"], marketPrice: 450, imageUrl: "https://images.pokemontcg.io/sv7/50.png", imageUrlHiRes: "https://images.pokemontcg.io/sv7/50_hires.png" },
    { id: "sv6-1", name: "Ogerpon ex", setId: "sv6", number: "001", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Basic", "ex"], marketPrice: 380, imageUrl: "https://images.pokemontcg.io/sv6/1.png", imageUrlHiRes: "https://images.pokemontcg.io/sv6/1_hires.png" },
    { id: "sv6-25", name: "Dragapult ex", setId: "sv6", number: "025", rarity: "Double Rare", supertype: "Pokemon", subtypes: ["Stage 2", "ex"], marketPrice: 520, imageUrl: "https://images.pokemontcg.io/sv6/25.png", imageUrlHiRes: "https://images.pokemontcg.io/sv6/25_hires.png" },
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
