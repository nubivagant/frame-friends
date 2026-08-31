"use strict";
const { Resend } = require("resend");
const config = require("./config");

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

async function sendPasswordSetEmail({ to, name, link, isReset }) {
  const subject = isReset ? "Reset your Frame Friends password" : "Set your Frame Friends password";
  const heading = isReset ? "Reset your password" : "Welcome to Frame Friends";
  const body = isReset
    ? "Click below to choose a new password. This link expires in an hour."
    : "Click below to set your password and get started. This link expires in an hour.";
  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>${heading}</h2>
      <p>Hi ${name},</p>
      <p>${body}</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#16170F;color:#fff;border-radius:999px;text-decoration:none;">Set password</a></p>
      <p style="color:#888;font-size:12px;">If the button doesn't work, paste this link into your browser:<br>${link}</p>
    </div>
  `;

  if (!resend) {
    // No RESEND_API_KEY configured — safe local-dev fallback so the flow is
    // still testable without sending real email.
    console.log(`\n[email:dev-fallback] Would send "${subject}" to ${to}\n  link: ${link}\n`);
    return { devFallback: true };
  }

  return resend.emails.send({
    from: config.resendFrom,
    to,
    subject,
    html,
  });
}

module.exports = { sendPasswordSetEmail };
