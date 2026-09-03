-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "cadenceWeeks" INTEGER NOT NULL DEFAULT 1;

-- Requested change: fortnightly rounds starting with the one that opens
-- when the currently-active week's deadline (already scheduled, untouched
-- by this migration) passes.
UPDATE "Settings" SET "cadenceWeeks" = 2 WHERE id = 1;
