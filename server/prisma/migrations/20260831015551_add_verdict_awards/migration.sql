-- AlterTable
ALTER TABLE "Verdict" ADD COLUMN     "awards" TEXT[] DEFAULT ARRAY[]::TEXT[];
