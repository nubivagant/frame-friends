"use strict";
const fs = require("fs/promises");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");
const { prisma } = require("./db");
const config = require("./config");
const { CRITERIA, computeAwards, sumScores } = require("./game");
const { photoAbsolutePath } = require("./photos");

const JUDGE_MODEL = "claude-sonnet-5";

function buildPrompt(week) {
  const rubric = CRITERIA.map((c) => `- ${c.key} (${c.label}): 0-10`).join("\n");
  return (
    `You are judging a private two-person photography game called Frame Friends.\n` +
    `This week's brief: "${week.brief}" (${week.inspiration})\n\n` +
    `Two photos are attached: "Photo A" and "Photo B", submitted anonymously — you don't know who took which. Judge them blind.\n` +
    `Score each photo 0-10 in exactly these categories:\n${rubric}\n\n` +
    `Reply with ONLY a JSON object, no other text, in exactly this shape:\n` +
    `{"scoresA":{"interpretation":n,"composition":n,"mood":n,"originality":n,"execution":n},` +
    `"scoresB":{"interpretation":n,"composition":n,"mood":n,"originality":n,"execution":n},` +
    `"critiqueA":"2-3 sentence critique of photo A","critiqueB":"2-3 sentence critique of photo B",` +
    `"comparison":"short comparison of the two","winner":"A"|"B"|"tie","why":"one sentence on why"}`
  );
}

async function imageBlock(submission) {
  const abs = photoAbsolutePath(submission.photoPath);
  const buf = await fs.readFile(abs);
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") },
  };
}

/** Runs the AI judge for a week that has exactly two submissions and no
 *  verdict yet. Safe to call speculatively — it's a no-op if a verdict
 *  already exists or the key isn't configured. */
async function runAiJudge(weekId) {
  if (!config.anthropicApiKey) return null;

  const week = await prisma.week.findUnique({ where: { id: weekId }, include: { submissions: true, verdict: true } });
  if (!week || week.verdict || week.submissions.length !== 2) return null;

  const [subA, subB] = week.submissions;
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(week) },
          { type: "text", text: "Photo A:" },
          await imageBlock(subA),
          { type: "text", text: "Photo B:" },
          await imageBlock(subB),
        ],
      },
    ],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    console.error(`[judge] failed to parse response for week ${week.number}:`, text);
    return null;
  }

  const scores = { [subA.id]: parsed.scoresA, [subB.id]: parsed.scoresB };
  const winnerSubmissionId = parsed.winner === "A" ? subA.id : parsed.winner === "B" ? subB.id : null;
  const awards =
    winnerSubmissionId != null
      ? computeAwards(winnerSubmissionId === subA.id ? parsed.scoresA : parsed.scoresB, winnerSubmissionId === subA.id ? parsed.scoresB : parsed.scoresA)
      : [];

  const verdict = await prisma.verdict.create({
    data: {
      weekId: week.id,
      source: "ai",
      judgeName: "Claude",
      critique: { [subA.id]: parsed.critiqueA, [subB.id]: parsed.critiqueB, comparison: parsed.comparison, why: parsed.why },
      scores,
      winnerSubmissionId,
      awards,
    },
  });

  return verdict;
}

module.exports = { runAiJudge };
