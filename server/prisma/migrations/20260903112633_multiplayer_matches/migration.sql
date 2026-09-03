-- Multi-player matches: introduces a Match model that Submission/Rating/
-- Verdict/Nudge scope to instead of Week directly. Hand-written (not the
-- auto-generated diff) because the auto diff adds matchId as NOT NULL with
-- no backfill, which fails outright against any existing data — and this
-- runs against production, which already has one real played week. Every
-- row that existed under the old exactly-two-players schema is backfilled
-- into a matching Match row instead of being dropped.

-- DropForeignKey
ALTER TABLE "Nudge" DROP CONSTRAINT "Nudge_weekId_fkey";
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_weekId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_weekId_fkey";
ALTER TABLE "Verdict" DROP CONSTRAINT "Verdict_weekId_fkey";

-- DropIndex
DROP INDEX "Nudge_weekId_toUserId_sentAt_idx";
DROP INDEX "Rating_weekId_raterId_key";
DROP INDEX "Submission_weekId_userId_key";
DROP INDEX "Verdict_weekId_key";

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "weekId" INTEGER NOT NULL,
    "playerAId" INTEGER,
    "playerBId" INTEGER,
    "forfeitedUserId" INTEGER,
    "lockedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- Backfill: one Match per legacy week that had any activity, inferring
-- playerA/playerB from the distinct users involved (submissions, ratings,
-- or nudges) — the old schema only ever had exactly two users sharing one
-- global week, so this recovers the real pairing exactly.
WITH week_users AS (
  SELECT "weekId" AS week_id, "userId" AS user_id FROM "Submission"
  UNION
  SELECT "weekId", "raterId" FROM "Rating"
  UNION
  SELECT "weekId", "fromUserId" FROM "Nudge"
  UNION
  SELECT "weekId", "toUserId" FROM "Nudge"
),
week_players AS (
  SELECT week_id, array_agg(DISTINCT user_id ORDER BY user_id) AS user_ids
  FROM week_users
  GROUP BY week_id
),
active_weeks AS (
  SELECT "weekId" AS week_id FROM "Submission"
  UNION
  SELECT "weekId" FROM "Rating"
  UNION
  SELECT "weekId" FROM "Verdict"
  UNION
  SELECT "weekId" FROM "Nudge"
)
INSERT INTO "Match" ("weekId", "playerAId", "playerBId", "createdAt")
SELECT aw.week_id, wp.user_ids[1], wp.user_ids[2], now()
FROM active_weeks aw
JOIN week_players wp ON wp.week_id = aw.week_id;

-- AlterTable: add matchId nullable first so it can be backfilled by join,
-- then tighten to NOT NULL once every row has one.
ALTER TABLE "Submission" ADD COLUMN "matchId" INTEGER;
UPDATE "Submission" s SET "matchId" = m.id FROM "Match" m WHERE m."weekId" = s."weekId";
ALTER TABLE "Submission" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "Submission" DROP COLUMN "weekId";

ALTER TABLE "Rating" ADD COLUMN "matchId" INTEGER;
UPDATE "Rating" r SET "matchId" = m.id FROM "Match" m WHERE m."weekId" = r."weekId";
ALTER TABLE "Rating" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "Rating" DROP COLUMN "weekId";

ALTER TABLE "Verdict" ADD COLUMN "matchId" INTEGER;
UPDATE "Verdict" v SET "matchId" = m.id FROM "Match" m WHERE m."weekId" = v."weekId";
ALTER TABLE "Verdict" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "Verdict" DROP COLUMN "weekId";

ALTER TABLE "Nudge" ADD COLUMN "matchId" INTEGER;
UPDATE "Nudge" n SET "matchId" = m.id FROM "Match" m WHERE m."weekId" = n."weekId";
ALTER TABLE "Nudge" ALTER COLUMN "matchId" SET NOT NULL;
ALTER TABLE "Nudge" DROP COLUMN "weekId";

-- AlterTable
ALTER TABLE "Week" DROP COLUMN "reminderSentAt";

-- Retroactively lock + finalize matches that were already fully decided
-- under the old rules (both submitted, or the week already archived) —
-- this is the actual fix for "the leaderboard didn't update": those
-- matches now count toward standings immediately instead of waiting on
-- the new 24h clock, which has no meaning for a result that already
-- happened before this migration ran.
UPDATE "Match" m
SET "lockedAt" = now(), "finalizedAt" = now()
WHERE (SELECT COUNT(*) FROM "Submission" s WHERE s."matchId" = m.id) = 2
   OR EXISTS (SELECT 1 FROM "Week" w WHERE w.id = m."weekId" AND w."archivedAt" IS NOT NULL);

-- CreateIndex
CREATE INDEX "Match_weekId_idx" ON "Match"("weekId");
CREATE INDEX "Nudge_matchId_toUserId_sentAt_idx" ON "Nudge"("matchId", "toUserId", "sentAt");
CREATE UNIQUE INDEX "Rating_matchId_raterId_key" ON "Rating"("matchId", "raterId");
CREATE UNIQUE INDEX "Submission_matchId_userId_key" ON "Submission"("matchId", "userId");
CREATE UNIQUE INDEX "Verdict_matchId_key" ON "Verdict"("matchId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_forfeitedUserId_fkey" FOREIGN KEY ("forfeitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Verdict" ADD CONSTRAINT "Verdict_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nudge" ADD CONSTRAINT "Nudge_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
