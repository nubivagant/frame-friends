"use strict";
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { prisma } = require("../db");
const { requireAuth, publicUser } = require("../auth");
const { CRITERIA, pickBriefFor } = require("../game");
const { getSettings, getCurrentWeek, rolloverIfNeeded, deriveStandings, computeWeekResult, isRevealed, WEEK_INCLUDE } = require("../weeks");
const { saveResizedPhoto, photoAbsolutePath } = require("../photos");
const { runAiJudge } = require("../judge");

const upload = multer({ limits: { fileSize: 24 * 1024 * 1024 } }); // 24MB, matches the old brief-page copy

const router = express.Router();
router.use(requireAuth);

function otherUserId(users, userId) {
  const other = users.find((u) => u.id !== userId);
  return other ? other.id : null;
}

function shapeSubmission(sub, { includePrivate }) {
  const base = { id: sub.id, userId: sub.userId, submitted: true, submittedAt: sub.submittedAt };
  if (!includePrivate) return base;
  return { ...base, title: sub.title, note: sub.note, caption: sub.caption, photoUrl: `/api/photos/${sub.id}` };
}

async function buildWeekPayload(week, requestingUserId) {
  const revealed = isRevealed(week);
  const mySubmission = week.submissions.find((s) => s.userId === requestingUserId) || null;
  const submissions = week.submissions.map((s) => shapeSubmission(s, { includePrivate: revealed || s.userId === requestingUserId }));
  const settings = await getSettings();
  const result = computeWeekResult(week);
  return {
    id: week.id,
    number: week.number,
    season: week.season,
    types: week.types,
    brief: week.brief,
    inspiration: week.inspiration,
    opened: week.opened,
    deadline: week.deadline,
    rerollsUsedThisSeason: week.rerollsUsedThisSeason,
    rerollTokensPerSeason: settings.rerollTokensPerSeason,
    revealed,
    submissions,
    mySubmitted: !!mySubmission,
    ratings: revealed ? week.ratings.map((r) => ({ raterId: r.raterId, scores: r.scores, note: r.note })) : [],
    verdict: week.verdict && revealed ? { judgeName: week.verdict.judgeName, critique: week.verdict.critique, source: week.verdict.source } : null,
    result: revealed ? result : { pending: true },
  };
}

router.get("/state", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const [users, settings, standings] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    getSettings(),
    deriveStandings(),
  ]);
  const weekPayload = await buildWeekPayload(week, req.session.userId);

  res.json({
    me: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } })),
    players: users.map((u) => ({ ...publicUser(u), standings: standings.byUser[u.id] })),
    settings,
    currentWeek: weekPayload,
    standings: { ties: standings.ties, weeks: standings.weeks },
  });
});

router.get("/archive", async (req, res) => {
  const weeks = await prisma.week.findMany({
    where: { archivedAt: { not: null } },
    include: WEEK_INCLUDE,
    orderBy: { number: "desc" },
  });
  const payload = await Promise.all(weeks.map((w) => buildWeekPayload(w, req.session.userId)));
  res.json({ weeks: payload });
});

router.get("/photos/:submissionId", async (req, res) => {
  const submission = await prisma.submission.findUnique({
    where: { id: Number(req.params.submissionId) },
    include: { week: true },
  });
  if (!submission) return res.status(404).end();

  const owns = submission.userId === req.session.userId;
  const submissionsCount = await prisma.submission.count({ where: { weekId: submission.weekId } });
  const revealed = submissionsCount === 2 || new Date() >= new Date(submission.week.deadline);

  if (!owns && !revealed) return res.status(403).json({ error: "not_revealed" });

  const abs = photoAbsolutePath(submission.photoPath);
  if (!fs.existsSync(abs)) return res.status(404).end();
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(abs);
});

router.post("/submissions", upload.single("photo"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "missing_photo" });
  const { week } = await rolloverIfNeeded();
  if (new Date() >= new Date(week.deadline)) return res.status(400).json({ error: "deadline_passed" });

  const relativePath = await saveResizedPhoto(req.file.buffer);
  const data = {
    title: (req.body.title || "").slice(0, 200),
    note: (req.body.note || "").slice(0, 200),
    caption: (req.body.caption || "").slice(0, 2000),
    photoPath: relativePath,
    submittedAt: new Date(),
  };

  const existing = await prisma.submission.findUnique({ where: { weekId_userId: { weekId: week.id, userId: req.session.userId } } });
  const submission = await prisma.submission.upsert({
    where: { weekId_userId: { weekId: week.id, userId: req.session.userId } },
    update: data,
    create: { ...data, weekId: week.id, userId: req.session.userId },
  });

  // clean up the old file if this was a replace
  if (existing && existing.photoPath !== relativePath) {
    require("../photos").deletePhoto(existing.photoPath).catch(() => {});
  }

  const count = await prisma.submission.count({ where: { weekId: week.id } });
  if (count === 2) {
    runAiJudge(week.id).catch((err) => console.error("[judge] failed", err));
  }

  res.json({ ok: true, submissionId: submission.id });
});

router.post("/ratings", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const scores = req.body && req.body.scores;
  if (!scores || typeof scores !== "object") return res.status(400).json({ error: "invalid_scores" });
  const cleaned = {};
  CRITERIA.forEach((c) => {
    const v = Number(scores[c.key]);
    cleaned[c.key] = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
  });
  if (week.submissions.length < 2) return res.status(400).json({ error: "not_revealed" });

  await prisma.rating.upsert({
    where: { weekId_raterId: { weekId: week.id, raterId: req.session.userId } },
    update: { scores: cleaned, note: (req.body.note || "").slice(0, 500) },
    create: { weekId: week.id, raterId: req.session.userId, scores: cleaned, note: (req.body.note || "").slice(0, 500) },
  });
  res.json({ ok: true });
});

router.post("/brief/reroll", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const settings = await getSettings();
  if (week.submissions.length > 0) return res.status(400).json({ error: "already_submitted" });
  if (week.rerollsUsedThisSeason >= settings.rerollTokensPerSeason) return res.status(400).json({ error: "no_rerolls_left" });

  const picked = pickBriefFor([], week.brief);
  await prisma.week.update({
    where: { id: week.id },
    data: { types: picked.types, brief: picked.brief, inspiration: picked.inspiration, rerollsUsedThisSeason: { increment: 1 } },
  });
  res.json({ ok: true });
});

router.patch("/settings", async (req, res) => {
  const { deadlineDay, deadlineTime, briefDropDay, rerollTokensPerSeason } = req.body || {};
  const data = {};
  if (deadlineDay) data.deadlineDay = String(deadlineDay);
  if (deadlineTime) data.deadlineTime = String(deadlineTime);
  if (briefDropDay) data.briefDropDay = String(briefDropDay);
  if (Number.isFinite(Number(rerollTokensPerSeason))) data.rerollTokensPerSeason = Number(rerollTokensPerSeason);
  const settings = await prisma.settings.update({ where: { id: 1 }, data });
  res.json({ settings });
});

router.patch("/players/me", async (req, res) => {
  const { name } = req.body || {};
  const data = {};
  if (name) data.name = String(name).slice(0, 60);
  const user = await prisma.user.update({ where: { id: req.session.userId }, data });
  res.json({ user: publicUser(user) });
});

module.exports = router;
