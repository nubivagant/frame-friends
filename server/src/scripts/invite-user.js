"use strict";
// One-off admin script: creates a User row and prints a raw set-password
// link, using the same token mechanism as the normal "forgot password" flow
// (see server/src/auth.js). No email is sent — RESEND_API_KEY isn't
// configured in production, so that step was already a no-op; this is how
// every account so far has actually been provisioned. Hand the printed link
// to the person directly (text, whatever) instead.
//
// Usage: node src/scripts/invite-user.js <slug> "<Display Name>" <email>
const crypto = require("crypto");
const { prisma } = require("../db");
const config = require("../config");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, same as auth.js

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

async function main() {
  const [slug, name, email] = process.argv.slice(2);
  if (!slug || !name || !email) {
    console.error('Usage: node src/scripts/invite-user.js <slug> "<Display Name>" <email>');
    process.exit(1);
  }

  const user = await prisma.user.upsert({
    where: { slug },
    update: { name, email: email.toLowerCase().trim() },
    create: { slug, name, email: email.toLowerCase().trim() },
  });

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const link = `${config.appUrl}/set-password?token=${rawToken}`;
  console.log(`\nUser "${name}" (${slug}) ready.`);
  console.log(`Set-password link (expires in 1h, send it now):\n  ${link}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
