"use strict";
const cron = require("node-cron");
const { rolloverIfNeeded, computeMatchResult, MATCH_INCLUDE } = require("./weeks");
const { runAiJudge } = require("./judge");
const { sendPushToUsers } = require("./push");
const { prisma } = require("./db");

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;
const FINALIZE_DELAY_MS = 24 * 60 * 60 * 1000;

async function sweep() {
  try {
    // rolloverIfNeeded() sends the new-brief push itself (see weeks.js) —
    // it's also called from the /api/state route, so the push has to be
    // attached to the state transition, not to this particular caller.
    const { week, rolledOver } = await rolloverIfNeeded();
    if (rolledOver) console.log(`[cron] rolled over to week ${week.number}`);

    for (const match of week.matches) {
      // catch-all: if a match somehow has two submissions and no verdict yet
      // (e.g. the server restarted between the second submit and the judge
      // call), run it now.
      if (match.submissions.length === 2 && !match.verdict) {
        await runAiJudge(match.id);
      }
      // Same lock trigger as isMatchRevealed() (weeks.js): both submitted, OR
      // the deadline passed regardless of how many did — a one-sided match
      // still needs to lock so it eventually shows up in the archive and
      // gets finalized (as a no-contest — computeMatchResult stays pending
      // with fewer than 2 submissions, so it never counts for/against
      // anyone) instead of sitting open forever.
      if (!match.lockedAt && (match.submissions.length === 2 || new Date() >= new Date(week.deadline))) {
        await prisma.match.update({ where: { id: match.id }, data: { lockedAt: new Date() } });
      }
      await maybeSendReminder(match, week);
    }

    await finalizeReadyMatches();
  } catch (err) {
    console.error("[cron] sweep failed", err);
  }
}

/** Fires once per match, ~24h before the week's deadline, to whichever side
 *  hasn't submitted yet. Skipped entirely if both already have. */
async function maybeSendReminder(match, week) {
  if (match.reminderSentAt) return;
  const msRemaining = new Date(week.deadline) - new Date();
  if (msRemaining > REMINDER_WINDOW_MS || msRemaining <= 0) return;

  const slotUserIds = [match.playerAId, match.playerBId].filter(Boolean);
  if (slotUserIds.length < 2) return; // bye / open slot — nobody to remind

  const submittedUserIds = new Set(match.submissions.map((s) => s.userId));
  const missing = slotUserIds.filter((id) => !submittedUserIds.has(id));

  await prisma.match.update({ where: { id: match.id }, data: { reminderSentAt: new Date() } });
  if (!missing.length) return; // both already in — nothing to remind anyone about

  await sendPushToUsers(missing, {
    title: "Submissions lock soon",
    body: `"${week.brief}" — you haven't submitted yet.`,
    url: "/upload",
  });
}

/** Any match locked 24h+ ago that hasn't finalized yet: compute the combined
 *  AI+peer score, stamp finalizedAt (the new standings gate — see
 *  deriveStandings in weeks.js), and let both players know. */
async function finalizeReadyMatches() {
  const cutoff = new Date(Date.now() - FINALIZE_DELAY_MS);
  const ready = await prisma.match.findMany({
    where: { lockedAt: { not: null, lte: cutoff }, finalizedAt: null },
    include: MATCH_INCLUDE,
  });

  for (const match of ready) {
    const result = computeMatchResult(match);
    await prisma.match.update({ where: { id: match.id }, data: { finalizedAt: new Date() } });
    if (result.pending) continue; // no verdict, no complete ratings — no contest, but still locked

    const slotUserIds = [match.playerAId, match.playerBId].filter(Boolean);
    const winnerSub = result.winnerSubmissionId != null ? match.submissions.find((s) => s.id === result.winnerSubmissionId) : null;
    await sendPushToUsers(slotUserIds, {
      title: "Final score is in",
      body: winnerSub ? "The combined score just locked in." : "It's a tie once the scores combined.",
      url: "/reveal",
    }).catch((err) => console.error("[push] finalize failed", err));
  }
}

function startCron() {
  // Every 15 minutes is frequent enough that the real Monday/Sunday
  // instants (computed in Europe/London, see game.js) are never missed by
  // more than a few minutes.
  cron.schedule("*/15 * * * *", sweep, { timezone: "Europe/London" });
  sweep(); // also run once at boot, so a long-stopped server catches up immediately
}

module.exports = { startCron, sweep };
