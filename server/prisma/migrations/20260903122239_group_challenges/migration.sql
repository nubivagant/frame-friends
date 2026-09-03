-- Group challenges: Match.playerAId/playerBId/forfeitedUserId (fixed
-- 2-slot columns) become a MatchParticipant join table, so a match can
-- hold 2-4 participants (or 1, for a bye) instead of exactly 2. Rating
-- gains an explicit submissionId since a rater can now rate more than one
-- other submission. Hand-written (not the Prisma auto-diff) because this
-- runs against live production data.

-- CreateTable
CREATE TABLE "MatchParticipant" (
    "id"              SERIAL  NOT NULL,
    "matchId"         INTEGER NOT NULL,
    "userId"          INTEGER,
    "forfeitedUserId" INTEGER,

    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

-- Backfill: two MatchParticipant rows per existing Match (slot A, slot B)
-- — every current Match already has exactly two such slots (a bye is just
-- playerBId: null), so this is a direct, lossless translation. Whichever
-- slot is null inherits the match's forfeitedUserId, if it had one.
INSERT INTO "MatchParticipant" ("matchId", "userId", "forfeitedUserId")
SELECT id, "playerAId", CASE WHEN "playerAId" IS NULL THEN "forfeitedUserId" ELSE NULL END FROM "Match";
INSERT INTO "MatchParticipant" ("matchId", "userId", "forfeitedUserId")
SELECT id, "playerBId", CASE WHEN "playerBId" IS NULL THEN "forfeitedUserId" ELSE NULL END FROM "Match";

-- DropForeignKey
ALTER TABLE "Match" DROP CONSTRAINT "Match_playerAId_fkey";
ALTER TABLE "Match" DROP CONSTRAINT "Match_playerBId_fkey";
ALTER TABLE "Match" DROP CONSTRAINT "Match_forfeitedUserId_fkey";

-- AlterTable
ALTER TABLE "Match" DROP COLUMN "playerAId";
ALTER TABLE "Match" DROP COLUMN "playerBId";
ALTER TABLE "Match" DROP COLUMN "forfeitedUserId";

-- AddForeignKey
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_forfeitedUserId_fkey" FOREIGN KEY ("forfeitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "MatchParticipant_matchId_idx" ON "MatchParticipant"("matchId");
CREATE INDEX "MatchParticipant_userId_idx" ON "MatchParticipant"("userId");

-- Rating: add submissionId, backfilled by joining to "whichever submission
-- in that match isn't the rater's own" — unambiguous under the old
-- exactly-2-submissions-per-match schema.
ALTER TABLE "Rating" ADD COLUMN "submissionId" INTEGER;
UPDATE "Rating" r
SET "submissionId" = s.id
FROM "Submission" s
WHERE s."matchId" = r."matchId" AND s."userId" != r."raterId";
ALTER TABLE "Rating" ALTER COLUMN "submissionId" SET NOT NULL;

-- DropIndex
DROP INDEX "Rating_matchId_raterId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Rating_matchId_raterId_submissionId_key" ON "Rating"("matchId", "raterId", "submissionId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Verdict.winnerSubmissionId/awards are unused downstream (computeMatchResult
-- derives its own winner+awards from combined AI+peer scores, never reads
-- these) — dropped rather than generalized.
ALTER TABLE "Verdict" DROP COLUMN "winnerSubmissionId";
ALTER TABLE "Verdict" DROP COLUMN "awards";
