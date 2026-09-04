"use strict";
// Admin helper: creates a User row, either with a password set directly or
// with a raw set-password link generated via the same token mechanism as
// the normal "forgot password" flow (see server/src/auth.js). No email is
// sent — RESEND_API_KEY isn't configured in production, so that step was
// already a no-op; this is how every account so far has actually been
// provisioned. Hand the printed credentials/link to the person directly
// (text, whatever) instead.
//
// CLI usage: node src/scripts/invite-user.js <slug> "<Display Name>" <email> [password]
// Also invoked at boot from seed.js when INVITE_SLUG/INVITE_NAME/INVITE_EMAIL
// (and optionally INVITE_PASSWORD) are set — lets a one-off invite ride
// along with a normal deploy instead of needing direct production database
// access.
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { prisma } = require("../db");
const config = require("../config");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour, same as auth.js

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** With a password: sets it directly, no link needed — returns { password }.
 *  Without one: generates a set-password link the same way "forgot
 *  password" does — returns { link }. */
async function inviteUser({ slug, name, email, password }) {
  const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
  const user = await prisma.user.upsert({
    where: { slug },
    update: { name, email: email.toLowerCase().trim(), ...(passwordHash ? { passwordHash } : {}) },
    create: { slug, name, email: email.toLowerCase().trim(), ...(passwordHash ? { passwordHash } : {}) },
  });

  if (password) return { password };

  const rawToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  return { link: `${config.appUrl}/set-password?token=${rawToken}` };
}

async function main() {
  const [slug, name, email, password] = process.argv.slice(2);
  if (!slug || !name || !email) {
    console.error('Usage: node src/scripts/invite-user.js <slug> "<Display Name>" <email> [password]');
    process.exit(1);
  }

  const result = await inviteUser({ slug, name, email, password });
  console.log(`\nUser "${name}" (${slug}) ready.`);
  if (result.password) console.log(`Email: ${email}\nPassword: ${result.password}\n`);
  else console.log(`Set-password link (expires in 1h, send it now):\n  ${result.link}\n`);
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { inviteUser };
