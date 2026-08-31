"use strict";
const { prisma } = require("./db");
const { pickBriefFor, sumScores, computeAwards, nextOccurrence } = require("./game");

const WEEK_INCLUDE = { submissions: true, ratings: true, verdict: true };

/** Winner/scores/awards for one week, derived from whatever's on record.
 *  AI verdict (if any) is canonical; otherwise falls back to mutual rating;
 *  otherwise the week is "pending" (no verdict yet). */
function computeWeekResult(week) {
  const subs = week.submissions;

  if (week.verdict) {
    const v = week.verdict;
    const scores = {};
    subs.forEach((s) => {
      scores[s.id] = sumScores((v.scores && v.scores[String(s.id)]) || {});
    });
    return {
      winnerSubmissionId: v.winnerSubmissionId,
      scores,
      awards: v.awards || [],
      source: "ai",
      judgeName: v.judgeName,
      critique: v.critique,
      pending: false,
    };
  }

  if (subs.length === 2 && week.ratings.length === 2) {
    const [a, b] = subs;
    const aRating = week.ratings.find((r) => r.raterId !== a.userId); // the OTHER player rated a's photo
    const bRating = week.ratings.find((r) => r.raterId !== b.userId);
    const scores = {
      [a.id]: aRating ? sumScores(aRating.scores) : 0,
      [b.id]: bRating ? sumScores(bRating.scores) : 0,
    };
    let winnerSubmissionId = null;
    let awards = [];
    if (scores[a.id] !== scores[b.id]) {
      winnerSubmissionId = scores[a.id] > scores[b.id] ? a.id : b.id;
      const winnerRating = winnerSubmissionId === a.id ? aRating : bRating;
      const loserRating = winnerSubmissionId === a.id ? bRating : aRating;
      awards = computeAwards(winnerRating.scores, loserRating.scores);
    }
    return { winnerSubmissionId, scores, awards, source: "mutual", pending: false };
  }

  return { winnerSubmissionId: null, scores: {}, awards: [], pending: true };
}

function isRevealed(week) {
  return week.submissions.length === 2 || new Date() >= new Date(week.deadline);
}

async function getSettings() {
  return prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
}

/** The single non-archived week — creates week 1 on first-ever boot. */
async function getCurrentWeek() {
  let week = await prisma.week.findFirst({ where: { archivedAt: null }, include: WEEK_INCLUDE, orderBy: { number: "desc" } });
  if (week) return week;

  const settings = await getSettings();
  const picked = pickBriefFor([]);
  const now = new Date();
  const opened = nextOccurrence(new Date(now.getTime() - 7 * 86400000), settings.briefDropDay, "00:00");
  const deadline = nextOccurrence(opened, settings.deadlineDay, settings.deadlineTime);
  week = await prisma.week.create({
    data: { number: 1, season: 1, types: picked.types, brief: picked.brief, inspiration: picked.inspiration, opened, deadline },
    include: WEEK_INCLUDE,
  });
  return week;
}

/** Archives the current week if its deadline has passed and opens the next
 *  one — looping to catch up through every missed week, not just one, the
 *  same fix that was needed in the artifact version. */
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

    await prisma.$transaction([
      prisma.week.update({ where: { id: week.id }, data: { archivedAt: new Date() } }),
      prisma.week.create({
        data: {
          number: nextNumber,
          season: newSeason,
          types: picked.types,
          brief: picked.brief,
          inspiration: picked.inspiration,
          opened,
          deadline,
          rerollsUsedThisSeason: newSeason !== week.season ? 0 : 0,
        },
      }),
    ]);
    rolledOver = true;
    week = await prisma.week.findUniqueOrThrow({ where: { number: nextNumber }, include: WEEK_INCLUDE });
  }

  return { week, rolledOver };
}

async function deriveStandings() {
  const archivedWeeks = await prisma.week.findMany({
    where: { archivedAt: { not: null } },
    include: WEEK_INCLUDE,
    orderBy: { number: "asc" },
  });
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  const byUser = {};
  users.forEach((u) => {
    byUser[u.id] = { wins: 0, points: 0, streakNow: 0, streakBest: 0, awards: 0 };
  });
  let ties = 0;

  archivedWeeks.forEach((week) => {
    const result = computeWeekResult(week);
    if (result.pending) return; // never rated — doesn't count for/against anyone
    week.submissions.forEach((s) => {
      byUser[s.userId].points += result.scores[s.id] || 0;
    });
    if (result.winnerSubmissionId == null) {
      ties += 1;
      users.forEach((u) => (byUser[u.id].streakNow = 0));
    } else {
      const winnerSub = week.submissions.find((s) => s.id === result.winnerSubmissionId);
      if (winnerSub) {
        byUser[winnerSub.userId].wins += 1;
        byUser[winnerSub.userId].awards += result.awards.length;
        byUser[winnerSub.userId].streakNow += 1;
        byUser[winnerSub.userId].streakBest = Math.max(byUser[winnerSub.userId].streakBest, byUser[winnerSub.userId].streakNow);
        week.submissions
          .filter((s) => s.userId !== winnerSub.userId)
          .forEach((s) => (byUser[s.userId].streakNow = 0));
      }
    }
  });

  const rated = archivedWeeks.filter((w) => !computeWeekResult(w).pending).length;
  users.forEach((u) => {
    byUser[u.id].avg = rated ? (byUser[u.id].points / rated).toFixed(1) : "0.0";
  });

  return { byUser, ties, weeks: archivedWeeks.length, rated };
}

module.exports = { getSettings, getCurrentWeek, rolloverIfNeeded, deriveStandings, computeWeekResult, isRevealed, WEEK_INCLUDE };
