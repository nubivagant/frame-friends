"use strict";
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const express = require("express");
const { prisma } = require("./db");
const { sendPasswordSetEmail } = require("./email");
const config = require("./config");

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function publicUser(user) {
  return { id: user.id, slug: user.slug, name: user.name, email: user.email, title: user.title, bio: user.bio, strengths: user.strengths };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "not_authenticated" });
  next();
}

async function currentUser(req) {
  if (!req.session.userId) return null;
  return prisma.user.findUnique({ where: { id: req.session.userId } });
}

const router = express.Router();

router.get("/me", async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ error: "not_authenticated" });
  res.json({ user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });
  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.passwordHash) return res.status(401).json({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// Used both for "forgot password" and for a seeded account's very first
// login (passwordHash starts null) — same token mechanism either way.
router.post("/request-link", async (req, res) => {
  const { email } = req.body || {};
  const normalized = String(email || "").toLowerCase().trim();
  const user = normalized ? await prisma.user.findUnique({ where: { email: normalized } }) : null;

  // Always respond the same way regardless of whether the email matched —
  // don't leak account existence to whoever's typing.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    const link = `${config.appUrl}/set-password?token=${rawToken}`;
    await sendPasswordSetEmail({
      to: user.email,
      name: user.name,
      link,
      isReset: !!user.passwordHash,
    }).catch((err) => console.error("[email] send failed", err));
  }

  res.json({ ok: true });
});

router.post("/reset", async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password || String(password).length < 8) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const tokenHash = hashToken(String(token));
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "invalid_or_expired_token" });
  }
  const passwordHash = await bcrypt.hash(String(password), 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // invalidate any other outstanding tokens for this user
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
});

module.exports = { router, requireAuth, currentUser, publicUser };
