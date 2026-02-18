import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // --- Cleanup stale data from previous seeds ---
  const seedCardIds = [
    // base1
    "base1-4", "base1-2", "base1-15", "base1-58",
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
    // base1 (Original Base Set) — localIds NOT zero-padded
    { id: "base1-4", name: "Charizard", setId: "base1", number: "4", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/4/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/4/high.webp" },
    { id: "base1-2", name: "Blastoise", setId: "base1", number: "2", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/2/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/2/high.webp" },
    { id: "base1-15", name: "Venusaur", setId: "base1", number: "15", rarity: "Rare Holo", supertype: "Pokemon", subtypes: ["Stage 2"], imageUrl: "https://assets.tcgdex.net/en/base/base1/15/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/15/high.webp" },
    { id: "base1-58", name: "Pikachu", setId: "base1", number: "58", rarity: "Common", supertype: "Pokemon", subtypes: ["Basic"], imageUrl: "https://assets.tcgdex.net/en/base/base1/58/high.webp", imageUrlHiRes: "https://assets.tcgdex.net/en/base/base1/58/high.webp" },

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
