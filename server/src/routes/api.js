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
  occupiedParticipants,
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

function shapeSubmission(sub, { includePrivate }) {
  const base = { id: sub.id, userId: sub.userId, submitted: true, submittedAt: sub.submittedAt };
  if (!includePrivate) return base;
  return { ...base, title: sub.title, note: sub.note, caption: sub.caption, photoUrl: `/api/photos/${sub.id}` };
}

async function buildMatchPayload(match, week, requestingUserId) {
  const revealed = isMatchRevealed(match, week);
  const occupied = occupiedParticipants(match);
  const otherIds = occupied.map((p) => p.userId).filter((id) => id !== requestingUserId);
  const mySub = match.submissions.find((s) => s.userId === requestingUserId) || null;

  // Pre-reveal, only ever show MY OWN submission row — showing anyone
  // else's (even just their userId, with no photo) would leak who's in
  // this match before the reveal is supposed to happen.
  const submissions = revealed
    ? match.submissions.map((s) => shapeSubmission(s, { includePrivate: true }))
    : mySub
    ? [shapeSubmission(mySub, { includePrivate: true })]
    : [];

  let participants = [];
  if (revealed && otherIds.length) {
    const users = await prisma.user.findMany({ where: { id: { in: otherIds } } });
    participants = users.map(publicUser);
  }

  const result = computeMatchResult(match);
  return {
    id: match.id,
    weekId: match.weekId,
    isBye: occupied.length < 2,
    canForfeit: occupied.length >= 2 && !mySub && new Date() < new Date(week.deadline),
    revealed,
    mySubmitted: !!mySub,
    submittedCount: match.submissions.length,
    totalCount: occupied.length,
    lockedAt: match.lockedAt,
    finalizedAt: match.finalizedAt,
    submissions,
    participants,
    ratings: revealed ? match.ratings.map((r) => ({ raterId: r.raterId, submissionId: r.submissionId, scores: r.scores, note: r.note })) : [],
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
// locked (everyone submitted, or deadline passed), so unlike
// buildMatchPayload (scoped to "my current match", with pre-reveal privacy
// rules) this shows every participant unconditionally.
function shapeArchivedMatch(match) {
  const result = computeMatchResult(match);
  return {
    id: match.id,
    weekId: match.weekId,
    week: { number: match.week.number, season: match.week.season, types: match.week.types, brief: match.week.brief, deadline: match.week.deadline },
    participants: match.participants.map((p) => ({ userId: p.userId, forfeitedUserId: p.forfeitedUserId })),
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
    include: { match: { include: { week: true, participants: true } } },
  });
  if (!submission) return res.status(404).end();

  const owns = submission.userId === req.session.userId;
  const submissionsCount = await prisma.submission.count({ where: { matchId: submission.matchId } });
  const occupiedCount = submission.match.participants.filter((p) => p.userId != null).length;
  const revealed = (occupiedCount >= 2 && submissionsCount === occupiedCount) || new Date() >= new Date(submission.match.week.deadline);

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
  const occupied = occupiedParticipants(match);
  if (occupied.length < 2) return res.status(400).json({ error: "no_opponent" }); // bye / open slot — nobody to submit into yet

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
  if (count === occupied.length) {
    await prisma.match.update({ where: { id: match.id }, data: { lockedAt: new Date() } });
    runAiJudge(match.id).catch((err) => console.error("[judge] failed", err));
    sendPushToUsers(
      occupied.map((p) => p.userId),
      { title: "Reveal is ready", body: `"${week.brief}" — everyone's in.`, url: "/reveal" }
    ).catch((err) => console.error("[push] reveal-ready failed", err));
  }

  res.json({ ok: true, submissionId: submission.id });
});

router.post("/nudge", async (req, res) => {
  const { week } = await rolloverIfNeeded();
  const match = findMyMatch(week, req.session.userId);
  if (!match) return res.status(400).json({ error: "no_match" });

  const submittedIds = new Set(match.submissions.map((s) => s.userId));
  const targets = occupiedParticipants(match)
    .map((p) => p.userId)
    .filter((id) => id !== req.session.userId && !submittedIds.has(id));
  if (!targets.length) return res.status(400).json({ error: "no_targets" });

  const recent = await prisma.nudge.findFirst({
    where: { matchId: match.id, fromUserId: req.session.userId, sentAt: { gte: new Date(Date.now() - NUDGE_COOLDOWN_MS) } },
    orderBy: { sentAt: "desc" },
  });
  if (recent) return res.status(429).json({ error: "rate_limited", retryAfter: recent.sentAt });

  const me = await prisma.user.findUnique({ where: { id: req.session.userId } });
  await prisma.nudge.createMany({ data: targets.map((toUserId) => ({ matchId: match.id, fromUserId: req.session.userId, toUserId })) });
  await sendPushToUsers(targets, { title: `${me.name} is waiting on you`, body: `"${week.brief}" — don't leave them hanging.`, url: "/upload" });

  res.json({ ok: true });
});

router.post("/matches/:id/forfeit", async (req, res) => {
  const matchId = Number(req.params.id);
  const { week } = await rolloverIfNeeded();
  const match = week.matches.find((m) => m.id === matchId);
  if (!match) return res.status(404).json({ error: "not_found" });
  const mySlot = match.participants.find((p) => p.userId === req.session.userId);
  if (!mySlot) return res.status(403).json({ error: "not_in_match" });
  if (new Date() >= new Date(week.deadline)) return res.status(400).json({ error: "deadline_passed" });
  if (match.submissions.some((s) => s.userId === req.session.userId)) return res.status(400).json({ error: "already_submitted" });

  await prisma.matchParticipant.update({ where: { id: mySlot.id }, data: { userId: null, forfeitedUserId: req.session.userId } });

  const others = occupiedParticipants(match)
    .map((p) => p.userId)
    .filter((id) => id !== req.session.userId);
  if (others.length) {
    sendPushToUsers(others, { title: "Someone forfeited this round", body: "Someone else may step in before the deadline.", url: "/" }).catch((err) =>
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

  const openSlot = match.participants.find((p) => p.userId == null);
  if (!openSlot) return res.status(400).json({ error: "match_full" });

  const joinable = findJoinableMatches(week, req.session.userId);
  if (!joinable.some((m) => m.id === matchId)) return res.status(400).json({ error: "not_eligible" });

  await prisma.matchParticipant.update({ where: { id: openSlot.id }, data: { userId: req.session.userId } });

  // clean up my own now-redundant match(es) for this week, if nobody ever submitted to them
  const mine = week.matches.filter((m) => m.id !== matchId && m.participants.some((p) => p.userId === req.session.userId));
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
  if (match.submissions.length < 2) return res.status(400).json({ error: "not_revealed" });

  const submissionId = Number(req.body && req.body.submissionId);
  const targetSub = match.submissions.find((s) => s.id === submissionId && s.userId !== req.session.userId);
  if (!targetSub) return res.status(400).json({ error: "invalid_submission" });

  const scores = req.body && req.body.scores;
  if (!scores || typeof scores !== "object") return res.status(400).json({ error: "invalid_scores" });
  const cleaned = {};
  CRITERIA.forEach((c) => {
    const v = Number(scores[c.key]);
    cleaned[c.key] = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 0;
  });

  await prisma.rating.upsert({
    where: { matchId_raterId_submissionId: { matchId: match.id, raterId: req.session.userId, submissionId } },
    update: { scores: cleaned, note: (req.body.note || "").slice(0, 500) },
    create: { matchId: match.id, raterId: req.session.userId, submissionId, scores: cleaned, note: (req.body.note || "").slice(0, 500) },
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
  const { deadlineDay, deadlineTime, briefDropDay, rerollTokensPerSeason, cadenceWeeks } = req.body || {};
  const data = {};
  if (deadlineDay) data.deadlineDay = String(deadlineDay);
  if (deadlineTime) data.deadlineTime = String(deadlineTime);
  if (briefDropDay) data.briefDropDay = String(briefDropDay);
  if (Number.isFinite(Number(rerollTokensPerSeason))) data.rerollTokensPerSeason = Number(rerollTokensPerSeason);
  if (Number.isFinite(Number(cadenceWeeks))) data.cadenceWeeks = Math.max(1, Math.min(8, Number(cadenceWeeks)));
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
