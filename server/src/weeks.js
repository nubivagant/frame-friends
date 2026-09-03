"use strict";
const { prisma } = require("./db");
const { pickBriefFor, sumScores, computeAwards, nextOccurrence } = require("./game");
const { sendPushToUsers } = require("./push");

const MATCH_INCLUDE = { submissions: true, ratings: true, verdict: true };
const WEEK_INCLUDE = { matches: { include: MATCH_INCLUDE } };

/** Combined score per submission — average of the AI judge's score and the
 *  other player's rating, falling back to whichever one exists if the other
 *  hasn't landed by the time this is checked. A match only has a real
 *  (non-pending) result once every submission has at least one of the two. */
function computeMatchResult(match) {
  const subs = match.submissions;
  if (subs.length < 2) return { winnerSubmissionId: null, scores: {}, awards: [], pending: true };

  const scores = {};
  subs.forEach((s) => {
    const aiScores = match.verdict ? match.verdict.scores[String(s.id)] : null;
    const peerRating = match.ratings.find((r) => r.raterId !== s.userId); // the OTHER player rated s's photo
    const aiSum = aiScores ? sumScores(aiScores) : null;
    const peerSum = peerRating ? sumScores(peerRating.scores) : null;
    const combined = aiSum != null && peerSum != null ? (aiSum + peerSum) / 2 : aiSum != null ? aiSum : peerSum;
    scores[s.id] = combined == null ? null : Math.round(combined * 10) / 10;
  });

  if (subs.some((s) => scores[s.id] == null)) {
    return { winnerSubmissionId: null, scores: {}, awards: [], pending: true };
  }

  const [a, b] = subs;
  let winnerSubmissionId = null;
  let awards = [];
  if (scores[a.id] !== scores[b.id]) {
    winnerSubmissionId = scores[a.id] > scores[b.id] ? a.id : b.id;
    const loserId = winnerSubmissionId === a.id ? b.id : a.id;
    const winnerAi = match.verdict && match.verdict.scores[String(winnerSubmissionId)];
    const loserAi = match.verdict && match.verdict.scores[String(loserId)];
    if (winnerAi) awards = computeAwards(winnerAi, loserAi);
  }
  return { winnerSubmissionId, scores, awards, pending: false };
}

/** A match "reveals" (photos + AI critique visible) once both sides have
 *  submitted, or the week's deadline passes — same trigger as before, now
 *  scoped per-match instead of per-week. The FINAL combined score is a
 *  separate, later gate: see Match.finalizedAt. */
function isMatchRevealed(match, week) {
  return match.submissions.length === 2 || new Date() >= new Date(week.deadline);
}

async function getSettings() {
  return prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
}

/** Randomly pairs every password-set user into Matches for a week. Odd one
 *  out gets a Match with playerBId: null (a bye) — the same shape a
 *  forfeit-vacated slot ends up in, so joining either case is one code path
 *  (see /api/matches/:id/join). */
async function createMatchesForWeek(weekId) {
  const users = await prisma.user.findMany({ where: { passwordHash: { not: null } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const data = [];
  for (let i = 0; i < ids.length; i += 2) {
    data.push({ weekId, playerAId: ids[i], playerBId: ids[i + 1] ?? null });
  }
  if (data.length) await prisma.match.createMany({ data });
}

/** The single non-archived week — creates week 1 (and its matches) on
 *  first-ever boot. */
async function getCurrentWeek() {
  let week = await prisma.week.findFirst({ where: { archivedAt: null }, include: WEEK_INCLUDE, orderBy: { number: "desc" } });
  if (week) {
    // A week can exist with zero matches — e.g. right after this migration
    // ran (the current week predates the Match concept and had no activity
    // yet for the backfill to reconstruct), or nobody had a password set
    // yet when the week was first created. Pair it now instead of leaving
    // everyone permanently match-less for the rest of the week.
    if (week.matches.length === 0) {
      await createMatchesForWeek(week.id);
      week = await prisma.week.findUniqueOrThrow({ where: { id: week.id }, include: WEEK_INCLUDE });
    }
    return week;
  }

  const settings = await getSettings();
  const picked = pickBriefFor([]);
  const now = new Date();
  const opened = nextOccurrence(new Date(now.getTime() - 7 * 86400000), settings.briefDropDay, "00:00");
  const deadline = nextOccurrence(opened, settings.deadlineDay, settings.deadlineTime);
  const created = await prisma.week.create({
    data: { number: 1, season: 1, types: picked.types, brief: picked.brief, inspiration: picked.inspiration, opened, deadline },
  });
  await createMatchesForWeek(created.id);
  return prisma.week.findUniqueOrThrow({ where: { id: created.id }, include: WEEK_INCLUDE });
}

/** Archives the current week if its deadline has passed, opens the next one
 *  and pairs its matches — looping to catch up through every missed week. */
async function rolloverIfNeeded() {
  const settings = await getSettings();
  let week = await getCurrentWeek();
  let rolledOver = false;
  let guard = 0;

  while (new Date() >= new Date(week.deadline) && guard < 104) {
    guard += 1;
    const recentPrimaries = await prisma.week
      .findMany({ where: { archivedAt: { not: null } }, orderBy: { number: "desc" }, take: 4, select: { types: true } })
      .then((ws) => ws.map((w) => w.types[0]));
    const picked = pickBriefFor(recentPrimaries.concat([week.types[0]]).slice(-4));

    const nextNumber = week.number + 1;
    const seasonLength = settings.seasonLength || 8;
    const newSeason = week.number % seasonLength === 0 ? week.season + 1 : week.season;
    const opened = nextOccurrence(new Date(week.deadline), settings.briefDropDay, "00:00");
    const deadline = nextOccurrence(opened, settings.deadlineDay, settings.deadlineTime);

    await prisma.week.update({ where: { id: week.id }, data: { archivedAt: new Date() } });
    const created = await prisma.week.create({
      data: { number: nextNumber, season: newSeason, types: picked.types, brief: picked.brief, inspiration: picked.inspiration, opened, deadline },
    });
    await createMatchesForWeek(created.id);

    rolledOver = true;
    week = await prisma.week.findUniqueOrThrow({ where: { id: created.id }, include: WEEK_INCLUDE });
  }

  // Attached to the transition itself, not to whichever caller happened to
  // trigger it — rolloverIfNeeded() is called both by the cron sweep and by
  // the /api/state route on every page load/poll, so a push wired only into
  // the cron caller would silently never fire whenever a page load won the
  // race instead (a real gap this had until it was actually load-tested).
  if (rolledOver) {
    const users = await prisma.user.findMany({ where: { passwordHash: { not: null } }, select: { id: true } });
    sendPushToUsers(
      users.map((u) => u.id),
      { title: "This week's brief is up", body: week.brief, url: "/brief" }
    ).catch((err) => console.error("[push] new-brief failed", err));
  }

  return { week, rolledOver };
}

/** The match a user is playing in this week, if any (every password-set
 *  user gets exactly one Match row per week — a real pairing or a bye). */
function findMyMatch(week, userId) {
  return week.matches.find((m) => m.playerAId === userId || m.playerBId === userId) || null;
}

/** Matches this week with an open slot (bye, or forfeit-vacated) that a
 *  user could step into. Eligible if they have no match of their own, or
 *  their own match is itself open (a bye, or the one they forfeited) — a
 *  bye player occupies a slot in their OWN placeholder match, but that
 *  doesn't count as "otherwise engaged": stepping into someone else's
 *  vacancy is exactly what a bye is for. */
function findJoinableMatches(week, userId) {
  const myMatch = findMyMatch(week, userId);
  const eligible = !myMatch || myMatch.playerAId == null || myMatch.playerBId == null;
  if (!eligible) return [];
  return week.matches.filter(
    (m) => m.id !== myMatch?.id && m.forfeitedUserId !== userId && (m.playerAId == null) !== (m.playerBId == null)
  ); // exactly one slot open, and not the one you just forfeited out of
}

async function deriveStandings() {
  const finalizedMatches = await prisma.match.findMany({
    where: { finalizedAt: { not: null } },
    include: MATCH_INCLUDE,
    orderBy: { finalizedAt: "asc" },
  });
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  const byUser = {};
  const ratedCount = {};
  users.forEach((u) => {
    byUser[u.id] = { wins: 0, points: 0, streakNow: 0, streakBest: 0, awards: 0, participationStreak: 0 };
    ratedCount[u.id] = 0;
  });
  let ties = 0;

  const scored = finalizedMatches.map((match) => ({ match, result: computeMatchResult(match) }));

  scored.forEach(({ match, result }) => {
    if (result.pending) return;
    match.submissions.forEach((s) => {
      byUser[s.userId].points += result.scores[s.id] || 0;
      ratedCount[s.userId] += 1;
    });
    if (result.winnerSubmissionId == null) {
      ties += 1;
      match.submissions.forEach((s) => (byUser[s.userId].streakNow = 0));
    } else {
      const winnerSub = match.submissions.find((s) => s.id === result.winnerSubmissionId);
      byUser[winnerSub.userId].wins += 1;
      byUser[winnerSub.userId].awards += result.awards.length;
      byUser[winnerSub.userId].streakNow += 1;
      byUser[winnerSub.userId].streakBest = Math.max(byUser[winnerSub.userId].streakBest, byUser[winnerSub.userId].streakNow);
      match.submissions.filter((s) => s.userId !== winnerSub.userId).forEach((s) => (byUser[s.userId].streakNow = 0));
    }
  });

  users.forEach((u) => {
    byUser[u.id].avg = ratedCount[u.id] ? (byUser[u.id].points / ratedCount[u.id]).toFixed(1) : "0.0";
  });

  // Per-user participation streak: YOUR consecutive weeks (most recent
  // first) with a real (non-bye) match where you submitted before deadline.
  // A bye week is simply skipped rather than breaking the streak — it's a
  // measure of your own reliability when you *do* have someone to shoot
  // against, not a "both of you" shared number anymore now that pairing
  // rotates.
  const realMatchesByUser = {};
  users.forEach((u) => (realMatchesByUser[u.id] = []));
  const allRealMatches = await prisma.match.findMany({
    where: { playerAId: { not: null }, playerBId: { not: null } },
    include: { submissions: true, week: true },
    orderBy: { week: { number: "desc" } },
  });
  allRealMatches.forEach((m) => {
    [m.playerAId, m.playerBId].forEach((uid) => realMatchesByUser[uid]?.push(m));
  });
  users.forEach((u) => {
    let streak = 0;
    for (const m of realMatchesByUser[u.id]) {
      if (m.submissions.some((s) => s.userId === u.id)) streak += 1;
      else break;
    }
    byUser[u.id].participationStreak = streak;
  });

  const rated = scored.filter(({ result }) => !result.pending).length;
  const weeksCounted = new Set(finalizedMatches.map((m) => m.weekId)).size;

  return { byUser, ties, weeks: weeksCounted, rated };
}

module.exports = {
  getSettings,
  getCurrentWeek,
  rolloverIfNeeded,
  deriveStandings,
  computeMatchResult,
  isMatchRevealed,
  findMyMatch,
  findJoinableMatches,
  createMatchesForWeek,
  WEEK_INCLUDE,
  MATCH_INCLUDE,
};
