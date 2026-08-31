require("dotenv").config();

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
}

module.exports = {
  port: Number(process.env.PORT || 3000),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  scottEmail: required("SCOTT_EMAIL").toLowerCase(),
  kurtisEmail: required("KURTIS_EMAIL").toLowerCase(),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || "Frame Friends <onboarding@resend.dev>",
  appUrl: (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, ""),
  photosDir: process.env.PHOTOS_DIR || "./.devdata/photos",
  isProduction: process.env.NODE_ENV === "production",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:scottshirbin@gmail.com",
};
