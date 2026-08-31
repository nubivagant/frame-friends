"use strict";
const webpush = require("web-push");
const { prisma } = require("./db");
const config = require("./config");

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  if (!config.vapidPublicKey || !config.vapidPrivateKey) return false;
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  configured = true;
  return true;
}

/** Pushes {title, body, url} to every device a user has subscribed from.
 *  Safe to call speculatively — no-ops quietly if VAPID isn't configured
 *  yet (same "works without the extra config, just does nothing" pattern
 *  used for the AI judge and email dev-fallback). */
async function sendPush(userId, { title, body, url = "/" }) {
  if (!ensureConfigured()) {
    console.log(`[push:unconfigured] Would notify user ${userId}: "${title}" — ${body}`);
    return;
  }
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          // subscription is dead (browser data cleared, uninstalled, etc.) — clean it up
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`[push] failed for user ${userId}:`, err.message);
        }
      }
    })
  );
}

async function sendPushToUsers(userIds, payload) {
  await Promise.all(userIds.map((id) => sendPush(id, payload)));
}

module.exports = { sendPush, sendPushToUsers };
