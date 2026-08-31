"use strict";
const cron = require("node-cron");
const { rolloverIfNeeded } = require("./weeks");
const { runAiJudge } = require("./judge");
const { sendPushToUsers } = require("./push");
const { prisma } = require("./db");

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

async function sweep() {
  try {
    // rolloverIfNeeded() sends the new-brief push itself (see weeks.js) —
    // it's also called from the /api/state route, so the push has to be
    // attached to the state transition, not to this particular caller.
    const { week, rolledOver } = await rolloverIfNeeded();
    if (rolledOver) console.log(`[cron] rolled over to week ${week.number}`);

    // catch-all: if the current week somehow has two submissions and no
    // verdict yet (e.g. the server restarted between the second submit and
    // the judge call), run it now.
    if (week.submissions.length === 2 && !week.verdict) {
      await runAiJudge(week.id);
    }

    await maybeSendReminder(week);
  } catch (err) {
    console.error("[cron] sweep failed", err);
  }
}

/** Fires once per week, ~24h before the deadline, to whoever hasn't
 *  submitted yet. Skipped entirely if both already have. */
async function maybeSendReminder(week) {
  if (week.reminderSentAt) return;
  const msRemaining = new Date(week.deadline) - new Date();
  if (msRemaining > REMINDER_WINDOW_MS || msRemaining <= 0) return;

  const submittedUserIds = new Set(week.submissions.map((s) => s.userId));
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const missing = allUsers.map((u) => u.id).filter((id) => !submittedUserIds.has(id));

  await prisma.week.update({ where: { id: week.id }, data: { reminderSentAt: new Date() } });
  if (!missing.length) return; // both already in — nothing to remind anyone about

  await sendPushToUsers(missing, {
    title: "Submissions lock soon",
    body: `"${week.brief}" — you haven't submitted yet.`,
    url: "/upload",
  });
}

function startCron() {
  // Every 15 minutes is frequent enough that the real Monday/Sunday
  // instants (computed in Europe/London, see game.js) are never missed by
  // more than a few minutes.
  cron.schedule("*/15 * * * *", sweep, { timezone: "Europe/London" });
  sweep(); // also run once at boot, so a long-stopped server catches up immediately
}

module.exports = { startCron, sweep };
