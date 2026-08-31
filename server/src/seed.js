"use strict";
const { prisma } = require("./db");
const config = require("./config");

async function upsertPlayer(slug, name, email) {
  await prisma.user.upsert({
    where: { slug },
    update: { email }, // email can be corrected via env var + redeploy; nothing else is overwritten
    create: { slug, name, email },
  });
}

async function seedSettings() {
  await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

async function main() {
  await upsertPlayer("scott", "Scott", config.scottEmail);
  await upsertPlayer("kurtis", "Kurtis", config.kurtisEmail);
  await seedSettings();
  console.log("Seeded users: scott, kurtis");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
