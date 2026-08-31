"use strict";
const cron = require("node-cron");
const { rolloverIfNeeded } = require("./weeks");
const { runAiJudge } = require("./judge");

async function sweep() {
  try {
    const { week, rolledOver } = await rolloverIfNeeded();
    if (rolledOver) console.log(`[cron] rolled over to week ${week.number}`);

    // catch-all: if the current week somehow has two submissions and no
    // verdict yet (e.g. the server restarted between the second submit and
    // the judge call), run it now.
    if (week.submissions.length === 2 && !week.verdict) {
      await runAiJudge(week.id);
    }
  } catch (err) {
    console.error("[cron] sweep failed", err);
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
