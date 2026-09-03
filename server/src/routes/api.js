"use strict";
const fs = require("fs");
const express = require("express");
const multer = require("multer");
const { prisma } = require("../db");
const { requireAuth, publicUser } = require("../auth");
const { CRITERIA, pickBriefFor } = require("../game");
const {
  getSettings,
  rolloverIfNeeded,
  deriveStandings,
  computeMatchResult,
  isMatchRevealed,
  findMyMatch,
  findJoinableMatches,
  MATCH_INCLUDE,
} = require("../weeks");
const { saveResizedPhoto, photoAbsolutePath } = require("../photos");
const { runAiJudge } = require("../judge");
const { sendPush, sendPushToUsers } = require("../push");
const config = require("../config");

const NUDGE_COOLDOWN_MS = 12 * 60 * 60 * 1000;

const upload = multer({ limits: { fileSize: 24 * 1024 * 1024 } }); // 24MB, matches the old brief-page copy

const router = express.Router();
router.use(requireAuth);

function opponentIdFor(match, userId) {
  if (match.playerAId === userId) return match.playerBId;
  if (match.playerBId === userId) return match.playerAId;
  return null;
}

function shapeSubmission(sub, { includePrivate }) {
  const base = { id: sub.id, userId: sub.userId, submitted: true, submittedAt: sub.submittedAt };
  if (!includePrivate) return base;
  return { ...base, title: sub.title, note: sub.note, caption: sub.caption, photoUrl: `/api/photos/${sub.id}` };
}

async function buildMatchPayload(match, week, requestingUserId) {
  const revealed = isMatchRevealed(match, week);
  const opponentId = opponentIdFor(match, requestingUserId);
  const mySub = match.submissions.find((s) => s.userId === requestingUserId) || null;
  const opponentSub = opponentId ? match.submissions.find((s) => s.userId === opponentId) || null : null;

  const submissions = match.submissions
    .filter((s) => s.userId === requestingUserId || s.userId === opponentId)
    .map((s) => shapeSubmission(s, { includePrivate: revealed || s.userId === requestingUserId }));

  let opponent = null;
  if (revealed && opponentId) {
    const u = await prisma.user.findUnique({ where: { id: opponentId } });
    if (u) opponent = publicUser(u);
  }

  const result = computeMatchResult(match);
  return {
    id: match.id,
    weekId: match.weekId,
    isBye: !opponentId,
    canForfeit: !!opponentId && !mySub && new Date() < new Date(week.deadline),
    revealed,
    mySubmitted: !!mySub,
    opponentSubmitted: !!opponentSub,
    lockedAt: match.lockedAt,
    finalizedAt: match.finalizedAt,
    submissions,
    opponent,
    ratings: revealed ? match.ratings.map((r) => ({ raterId: r.raterId, scores: r.scores, note: r.note })) : [],
    verdict: match.verdict && revealed ? { judgeName: match.verdict.judgeName, critique: match.verdict.critique, source: match.verdict.source } : null,
    result: match.finalizedAt ? result : { pending: true },
  };
}

router.get("/state", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const [users, settings, standings] = await Promise.all([
    prisma.user.findMany({ orderBy: { id: "asc" } }),
    getSettings(),
    deriveStandings(),
  ]);

  const myMatch = findMyMatch(week, req.session.userId);
  const myMatchPayload = myMatch ? await buildMatchPayload(myMatch, week, req.session.userId) : null;
  const joinableMatches = findJoinableMatches(week, req.session.userId).map((m) => ({ id: m.id, weekId: m.weekId }));

  // Who's submitted anything this week, globally — safe to show without
  // breaking blind pairing, since it says nothing about who's matched with
  // whom, just each person's own status.
  const submittedUserIds = new Set();
  week.matches.forEach((m) => m.submissions.forEach((s) => submittedUserIds.add(s.userId)));

  res.json({
    me: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: req.session.userId } })),
    players: users.map((u) => ({ ...publicUser(u), standings: standings.byUser[u.id] })),
    settings,
    currentWeek: {
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
      anySubmitted: submittedUserIds.size > 0,
      submittedUserIds: Array.from(submittedUserIds),
    },
    myMatch: myMatchPayload,
    joinableMatches,
    standings: { ties: standings.ties, weeks: standings.weeks },
  });
});

// Archive is a shared, public record — every match returned here is already
// locked (both submitted, or deadline passed), so unlike buildMatchPayload
// (scoped to "my current match", with pre-reveal privacy rules) this shows
// both sides unconditionally, for whichever two players were in it.
function shapeArchivedMatch(match) {
  const result = computeMatchResult(match);
  return {
    id: match.id,
    weekId: match.weekId,
    week: { number: match.week.number, season: match.week.season, types: match.week.types, brief: match.week.brief, deadline: match.week.deadline },
    playerAId: match.playerAId,
    playerBId: match.playerBId,
    forfeitedUserId: match.forfeitedUserId,
    finalizedAt: match.finalizedAt,
    submissions: match.submissions.map((s) => shapeSubmission(s, { includePrivate: true })),
    result: match.finalizedAt ? result : { pending: true },
  };
}

router.get("/archive", async (req, res) => {
  const matches = await prisma.match.findMany({
    where: { lockedAt: { not: null } },
    include: { ...MATCH_INCLUDE, week: true },
    orderBy: [{ week: { number: "desc" } }, { id: "asc" }],
  });
  res.json({ matches: matches.map(shapeArchivedMatch) });
});

router.get("/photos/:submissionId", async (req, res) => {
  const submission = await prisma.submission.findUnique({
    where: { id: Number(req.params.submissionId) },
    include: { match: { include: { week: true } } },
  });
  if (!submission) return res.status(404).end();

  const owns = submission.userId === req.session.userId;
  const submissionsCount = await prisma.submission.count({ where: { matchId: submission.matchId } });
  const revealed = submissionsCount === 2 || new Date() >= new Date(submission.match.week.deadline);

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

  const match = findMyMatch(week, req.session.userId);
  if (!match) return res.status(400).json({ error: "no_match" });
  const opponentId = opponentIdFor(match, req.session.userId);
  if (!opponentId) return res.status(400).json({ error: "no_opponent" }); // bye / open slot — nothing to submit into yet

  const relativePath = await saveResizedPhoto(req.file.buffer);
  const data = {
    title: (req.body.title || "").slice(0, 200),
    note: (req.body.note || "").slice(0, 200),
    caption: (req.body.caption || "").slice(0, 2000),
    photoPath: relativePath,
    submittedAt: new Date(),
  };

  const existing = await prisma.submission.findUnique({ where: { matchId_userId: { matchId: match.id, userId: req.session.userId } } });
  const submission = await prisma.submission.upsert({
    where: { matchId_userId: { matchId: match.id, userId: req.session.userId } },
    update: data,
    create: { ...data, matchId: match.id, userId: req.session.userId },
  });

  // clean up the old file if this was a replace
  if (existing && existing.photoPath !== relativePath) {
    require("../photos").deletePhoto(existing.photoPath).catch(() => {});
  }

  const count = await prisma.submission.count({ where: { matchId: match.id } });
  if (count === 2) {
    await prisma.match.update({ where: { id: match.id }, data: { lockedAt: new Date() } });
    runAiJudge(match.id).catch((err) => console.error("[judge] failed", err));
    sendPushToUsers([match.playerAId, match.playerBId], {
      title: "Reveal is ready",
      body: `"${week.brief}" — both of you are in.`,
      url: "/reveal",
    }).catch((err) => console.error("[push] reveal-ready failed", err));
  }

  res.json({ ok: true, submissionId: submission.id });
});

router.post("/nudge", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const match = findMyMatch(week, req.session.userId);
  if (!match) return res.status(400).json({ error: "no_match" });
  const targetId = opponentIdFor(match, req.session.userId);
  if (!targetId) return res.status(400).json({ error: "no_opponent" });

  const alreadySubmitted = match.submissions.some((s) => s.userId === targetId);
  if (alreadySubmitted) return res.status(400).json({ error: "already_submitted" });

  const recent = await prisma.nudge.findFirst({
    where: { matchId: match.id, toUserId: targetId, sentAt: { gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) } },
    orderBy: { sentAt: "desc" },
  });
  if (recent) return res.status(429).json({ error: "rate_limited", retryAfter: recent.sentAt });

  const me = await prisma.user.findUnique({ where: { id: req.session.userId } });
  await prisma.nudge.create({ data: { matchId: match.id, fromUserId: req.session.userId, toUserId: targetId } });
  await sendPush(targetId, { title: `${me.name} is waiting on you`, body: `"${week.brief}" — don't leave them hanging.`, url: "/upload" });

  res.json({ ok: true });
});

router.post("/matches/:id/forfeit", async (req, res) => {
  const matchId = Number(req.params.id);
  const { week } = await rolloverIfNeeded();
  const match = week.matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "not_found" });
  if (match.playerAId !== req.session.userId && match.playerBId !== req.session.userId) {
    return res.status(403).json({ error: "not_in_match" });
  }
  if (new Date() >= new Date(week.deadline)) return res.status(400).json({ error: "deadline_passed" });
  if (match.submissions.some((s) => s.userId === req.session.userId)) return res.status(400).json({ error: "already_submitted" });

  const data = match.playerAId === req.session.userId ? { playerAId: null, forfeitedUserId: req.session.userId } : { playerBId: null, forfeitedUserId: req.session.userId };
  await prisma.match.update({ where: { id: matchId }, data });

  const opponentId = opponentIdFor(match, req.session.userId);
  if (opponentId) {
    sendPush(opponentId, { title: "Your opponent forfeited", body: "Someone else may step in before the deadline.", url: "/" }).catch((err) =>
      console.error("[push] forfeit failed", err)
    );
  }
  res.json({ ok: true });
});

router.post("/matches/:id/join", async (req, res) => {
  const matchId = Number(req.params.id);
  const { week } = await rolloverIfNeeded();
  const match = week.matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "not_found" });
  if (new Date() >= new Date(week.deadline)) return res.status(400).json({ error: "deadline_passed" });
  if (match.playerAId && match.playerBId) return res.status(400).json({ error: "match_full" });
  if (match.forfeitedUserId === req.session.userId) return res.status(400).json({ error: "cant_rejoin_own_forfeit" });

  const joinable = findJoinableMatches(week, req.session.userId);
  if (!joinable.some((m) => m.id === matchId)) return res.status(400).json({ error: "not_eligible" });

  const data = match.playerAId == null ? { playerAId: req.session.userId } : { playerBId: req.session.userId };
  await prisma.match.update({ where: { id: matchId }, data });

  // clean up my own now-redundant match(es) for this week, if nobody ever submitted to them
  const mine = week.matches.filter((m) => m.id !== matchId && (m.playerAId === req.session.userId || m.playerBId === req.session.userId));
  for (const m of mine) {
    const subCount = await prisma.submission.count({ where: { matchId: m.id } });
    if (subCount === 0) await prisma.match.delete({ where: { id: m.id } }).catch(() => {});
  }

  res.json({ ok: true });
});

router.get("/push/vapid-public-key", (req, res) => {
  res.json({ key: config.vapidPublicKey || null });
});

router.post("/push/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys || !keys.p256dh || !keys.auth) return res.status(400).json({ error: "invalid_subscription" });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.session.userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { endpoint, userId: req.session.userId, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.json({ ok: true });
});

router.post("/push/unsubscribe", async (req, res) => {
  const { endpoint } = req.body || {};
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.session.userId } });
  res.json({ ok: true });
});

router.post("/ratings", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const match = findMyMatch(week, req.session.userId);
  if (!match) return res.status(400).json({ error: "no_match" });
  if (match.finalizedAt) return res.status(400).json({ error: "already_finalized" });
  const scores = req.body && req.body.scores;
  if (!scores || typeof scores !== "object") return res.status(400).json({ error: "invalid_scores" });
  const cleaned = {};
  CRITERIA.forEach((c) => {
    const v = Number(scores[c.key]);
    cleaned[c.key] = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
  });
  if (match.submissions.length < 2) return res.status(400).json({ error: "not_revealed" });

  await prisma.rating.upsert({
    where: { matchId_raterId: { matchId: match.id, raterId: req.session.userId } },
    update: { scores: cleaned, note: (req.body.note || "").slice(0, 500) },
    create: { matchId: match.id, raterId: req.session.userId, scores: cleaned, note: (req.body.note || "").slice(0, 500) },
  });
  res.json({ ok: true });
});

router.post("/brief/reroll", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const settings = await getSettings();
  const anySubmitted = week.matches.some((m) => m.submissions.length > 0);
  if (anySubmitted) return res.status(400).json({ error: "already_submitted" });
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
