# Frame Friends

A weekly photography ritual for two, now a real standalone app (previously a
Claude Artifact — that version is kept in `legacy/index.html` for reference).

## Layout

- `server/` — Node/Express API, Prisma/Postgres, photo storage, cron rollover, AI judging.
- `web/` — Vite + React frontend, built to static files the server serves.
- `legacy/index.html` — the original Claude Artifact version.

## Running locally

You need Node 20+. Everything else — Postgres included — can run without
installing anything system-wide.

```bash
# 1. install deps
cd server && npm install
cd ../web && npm install

# 2. start a local Postgres (spins up a real embedded Postgres, no Docker/brew needed)
cd ../server && node scripts/dev-pg.js
# leave this running in its own terminal

# 3. in another terminal: configure env
cp server/.env.example server/.env
# edit server/.env — at minimum set SCOTT_EMAIL / KURTIS_EMAIL to real addresses
# leave RESEND_API_KEY and ANTHROPIC_API_KEY blank for local dev: emails print
# to the server console instead of sending, and AI judging silently no-ops.

# 4. set up the database
cd server
npx prisma migrate dev
node src/seed.js   # creates the Scott + Kurtis accounts

# 5. run the app
node src/index.js
# in another terminal, for frontend hot-reload during development:
cd ../web && npm run dev   # http://localhost:5173, proxies /api to :3000
```

First login: use "Forgot password / first time here" with one of the seeded
emails — since `RESEND_API_KEY` is unset locally, the reset link is printed
to the server's console instead of emailed.

## Deploying on Railway

This repo builds as **one Railway service** — `railway.json` at the repo
root tells Railway how to build both `web` and `server` and how to start it.
You'll need to do the following in the Railway dashboard yourself (I can't
provision resources on your account):

1. **Create a project**, connect this GitHub repo.
2. **Add a Postgres plugin** to the project — Railway wires `DATABASE_URL`
   into your service automatically.
3. **Add a Volume** to the service, mounted at e.g. `/data/photos`. Set the
   `PHOTOS_DIR` env var to that same path. This is what actually removes
   the photo-storage ceiling the Claude Artifact version had.
4. **Set environment variables** on the service (see `server/.env.example`
   for the full list):
   - `SESSION_SECRET` — any long random string.
   - `SCOTT_EMAIL` / `KURTIS_EMAIL` — your real email addresses.
   - `RESEND_API_KEY` + `RESEND_FROM` — sign up at resend.com, verify a
     sending domain (or use their default `onboarding@resend.dev` sender
     for low volume).
   - `ANTHROPIC_API_KEY` — for automatic weekly AI judging.
   - `APP_URL` — the Railway-assigned public URL (or your custom domain),
     used to build links in password-set/reset emails.
   - `PHOTOS_DIR` — the Volume's mount path.
   - `NODE_ENV=production`.
5. **Deploy.** Every boot runs `prisma migrate deploy` then the (idempotent)
   seed script automatically (see `server/package.json`'s `start` script),
   so the Scott/Kurtis accounts just exist — nothing manual to run.
6. Visit the deployed URL, use "Forgot password / first time here" with
   each of your real emails to set your passwords.
