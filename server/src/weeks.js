"use strict";
const { prisma } = require("./db");
const { pickBriefFor, sumScores, computeAwards, nextOccurrence, nextOccurrenceWithCadence } = require("./game");
const { sendPushToUsers } = require("./push");

const MATCH_INCLUDE = { participants: true, submissions: true, ratings: true, verdict: true };
const WEEK_INCLUDE = { matches: { include: MATCH_INCLUDE } };

const GROUP_MAX_PLAYERS = 4; // groups run through this many active players; random 1v1 pairing kicks in above it

function occupiedParticipants(match) {
  return match.participants.filter((p) => p.userId != null);
}

/** Combined score per submission — average of the AI judge's score and the
 *  mean of however many peer ratings that submission got (0 to N-1 in a
 *  group), falling back to whichever source exists if the other hasn't
 *  landed yet. A match only has a real (non-pending) result once every
 *  submission that exists has at least one of the two. A duel is just the
 *  N=2 case of this — nothing here special-cases it. */
function computeMatchResult(match) {
  const subs = match.submissions;
  if (subs.length < 2) return { winnerSubmissionId: null, scores: {}, awards: [], pending: true };

  const scores = {};
  subs.forEach((s) => {
    const aiScores = match.verdict ? match.verdict.scores[String(s.id)] : null;
    const peerRatings = match.ratings.filter((r) => r.submissionId === s.id);
    const aiSum = aiScores ? sumScores(aiScores) : null;
    const peerSum = peerRatings.length ? peerRatings.reduce((sum, r) => sum + sumScores(r.scores), 0) / peerRatings.length : null;
    const combined = aiSum != null && peerSum != null ? (aiSum + peerSum) / 2 : aiSum != null ? aiSum : peerSum;
    scores[s.id] = combined == null ? null : Math.round(combined * 10) / 10;
  });

  if (subs.some((s) => scores[s.id] == null)) {
    return { winnerSubmissionId: null, scores: {}, awards: [], pending: true };
  }

  const ranked = [...subs].sort((a, b) => scores[b.id] - scores[a.id]);
  const topScore = scores[ranked[0].id];
  const tiedForFirst = ranked.filter((s) => scores[s.id] === topScore);

  let winnerSubmissionId = null;
  let awards = [];
  if (tiedForFirst.length === 1) {
    winnerSubmissionId = ranked[0].id;
    const runnerUp = ranked[1]; // always exists — subs.length >= 2, checked above
    const winnerAi = match.verdict && match.verdict.scores[String(winnerSubmissionId)];
    const runnerUpAi = match.verdict && match.verdict.scores[String(runnerUp.id)];
    if (winnerAi) awards = computeAwards(winnerAi, runnerUpAi);
  }
  return { winnerSubmissionId, scores, awards, pending: false };
}

/** A match "reveals" (photos + AI critique visible) once everyone in an
 *  occupied slot has submitted, or the week's deadline passes. */
function isMatchRevealed(match, week) {
  const occupied = occupiedParticipants(match).length;
  return (occupied > 0 && match.submissions.length === occupied) || new Date() >= new Date(week.deadline);
}

async function getSettings() {
  return prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
}

/** Groups run through GROUP_MAX_PLAYERS active players — everyone plays one
 *  shared round together, no bye. Above that, falls back to the original
 *  random 1v1 pairing with a bye for the odd one out. Either way, a bye or
 *  a forfeit-vacated slot is a MatchParticipant row with userId: null, so
 *  /api/matches/:id/join can fill either case with one code path. */
async function createMatchesForWeek(weekId) {
  const users = await prisma.user.findMany({ where: { passwordHash: { not: null } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  if (!ids.length) return;

  if (ids.length <= GROUP_MAX_PLAYERS) {
    await prisma.match.create({ data: { weekId, participants: { create: ids.map((userId) => ({ userId })) } } });
    return;
  }

  for (let i = 0; i < ids.length; i += 2) {
    // A solo bye still gets an explicit open second slot (userId: null) —
    // without one, there'd be nothing for /api/matches/:id/join to fill.
    const slotIds = ids[i + 1] != null ? [ids[i], ids[i + 1]] : [ids[i], null];
    await prisma.match.create({ data: { weekId, participants: { create: slotIds.map((userId) => ({ userId })) } } });
  }
}

/** The single non-archived week — creates week 1 (and its matches) on
 *  first-ever boot. */
async function getCurrentWeek() {
  let week = await prisma.week.findFirst({ where: { archivedAt: null }, include: WEEK_INCLUDE, orderBy: { number: "desc" } });
  if (week) {
    // A week can exist with zero matches — e.g. right after a migration ran
    // (the current week predates whatever changed and had no activity yet
    // for a backfill to reconstruct), or nobody had a password set yet when
    // the week was first created. Pair it now instead of leaving everyone
    // permanently match-less for the rest of the week.
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
    // Rounds chain continuously — the next one opens the instant the
    // previous one locks, no separate briefDropDay gap — so a fortnightly
    // (or longer) cadence stretches the round itself out to that many
    // weeks, rather than leaving idle time between back-to-back weekly ones.
    const opened = new Date(week.deadline);
    const deadline = nextOccurrenceWithCadence(opened, settings.deadlineDay, settings.deadlineTime, settings.cadenceWeeks);

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
 *  user gets exactly one Match row per week — a real pairing/group or a
 *  bye). */
function findMyMatch(week, userId) {
  return week.matches.find((m) => m.participants.some((p) => p.userId === userId)) || null;
}

/** Matches this week with an open slot (bye, or forfeit-vacated) that a
 *  user could step into. Eligible if they have no match of their own, or
 *  their own match is itself short a slot (a bye, or the one they
 *  forfeited) — a bye player occupies a slot in their OWN placeholder
 *  match, but that doesn't count as "otherwise engaged": stepping into
 *  someone else's vacancy is exactly what a bye is for. In a full group
 *  (everyone eligible already in the one match), a forfeited slot simply
 *  has no eligible joiner — same code path, it just naturally finds none. */
function findJoinableMatches(week, userId) {
  const myMatch = findMyMatch(week, userId);
  const myOpenSlots = myMatch ? myMatch.participants.filter((p) => p.userId == null).length : 0;
  const eligible = !myMatch || myOpenSlots > 0;
  if (!eligible) return [];
  return week.matches.filter(
    (m) =>
      m.id !== myMatch?.id &&
      m.participants.some((p) => p.userId == null) &&
      !m.participants.some((p) => p.forfeitedUserId === userId) // not the one you just forfeited out of
  );
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
  // first) with a real (non-solo) match where you submitted before
  // deadline. A bye week is simply skipped rather than breaking the streak
  // — it's a measure of your own reliability when you *do* have a round to
  // shoot for, not tied to exactly one opponent anymore now that pairing
  // (and group size) rotates.
  const realMatchesByUser = {};
  users.forEach((u) => (realMatchesByUser[u.id] = []));
  const allMatches = await prisma.match.findMany({
    include: { participants: true, submissions: true, week: true },
    orderBy: { week: { number: "desc" } },
  });
  allMatches.forEach((m) => {
    const occupied = occupiedParticipants(m);
    if (occupied.length < 2) return; // solo bye — doesn't count either way
    occupied.forEach((p) => realMatchesByUser[p.userId]?.push(m));
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
  occupiedParticipants,
  WEEK_INCLUDE,
  MATCH_INCLUDE,
};
