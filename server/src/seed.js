"use strict";
const { prisma } = require("./db");
const config = require("./config");
const { BRIEF_BANK } = require("./game");
const { inviteUser } = require("./scripts/invite-user");

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

// One-off invite riding along with a normal deploy — set INVITE_SLUG/
// INVITE_NAME/INVITE_EMAIL (and optionally INVITE_PASSWORD, to set a
// password directly instead of generating a link) as service variables,
// redeploy, read the printed credentials/link from the boot log, then
// unset the variables so it doesn't re-invite (harmlessly, but
// pointlessly) on every future boot.
async function maybeInviteFromEnv() {
  const { INVITE_SLUG, INVITE_NAME, INVITE_EMAIL, INVITE_PASSWORD } = process.env;
  if (!INVITE_SLUG || !INVITE_NAME || !INVITE_EMAIL) return;
  const result = await inviteUser({ slug: INVITE_SLUG, name: INVITE_NAME, email: INVITE_EMAIL, password: INVITE_PASSWORD });
  if (result.password) {
    console.log(`[invite] "${INVITE_NAME}" (${INVITE_SLUG}) ready — email: ${INVITE_EMAIL}, password: ${result.password}`);
  } else {
    console.log(`[invite] "${INVITE_NAME}" (${INVITE_SLUG}) ready — set-password link (expires in 1h):\n  ${result.link}`);
  }
}

// Keeps the live round's "From the Judge" copy in sync with BRIEF_BANK —
// a Week snapshots its brief/inspiration text at creation time, so an
// edit to the copy bank only reaches future rounds unless this runs too.
// Archived weeks are left alone; they're history, not a live display.
async function refreshCurrentWeekInspiration() {
  const week = await prisma.week.findFirst({ where: { archivedAt: null }, orderBy: { number: "desc" } });
  if (!week) return;
  const entry = BRIEF_BANK.find((b) => b.brief === week.brief);
  if (entry && entry.inspiration !== week.inspiration) {
    await prisma.week.update({ where: { id: week.id }, data: { inspiration: entry.inspiration } });
    console.log(`[seed] refreshed "From the Judge" copy for the live round (week ${week.number})`);
  }
}

async function main() {
  await upsertPlayer("scott", "Scott", config.scottEmail);
  await upsertPlayer("kurtis", "Kurtis", config.kurtisEmail);
  await seedSettings();
  await refreshCurrentWeekInspiration();
  await maybeInviteFromEnv();
  console.log("Seeded users: scott, kurtis");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
