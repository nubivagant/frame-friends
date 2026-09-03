"use strict";
const fs = require("fs/promises");
const Anthropic = require("@anthropic-ai/sdk");
const { prisma } = require("./db");
const config = require("./config");
const { CRITERIA } = require("./game");
const { photoAbsolutePath } = require("./photos");

const JUDGE_MODEL = "claude-sonnet-5";
const LABELS = ["A", "B", "C", "D"];

function buildPrompt(week, labeled) {
  const rubric = CRITERIA.map((c) => `- ${c.key} (${c.label}): 0-10`).join("\n");
  const names = labeled.map(({ label }) => `"Photo ${label}"`).join(", ");
  const scoresShape = labeled.map(({ label }) => `"scores${label}":{"interpretation":n,"composition":n,"mood":n,"originality":n,"execution":n}`).join(",");
  const critiqueShape = labeled.map(({ label }) => `"critique${label}":"2-3 sentence critique of photo ${label}"`).join(",");
  return (
    `You are judging one round of a private photography game called Frame Friends. ${labeled.length} photos were submitted this round.\n` +
    `This week's brief: "${week.brief}" (${week.inspiration})\n\n` +
    `${labeled.length} photos are attached: ${names}, submitted anonymously — you don't know who took which. Judge each blind, on its own merits against the brief.\n` +
    `Score EVERY photo 0-10 in exactly these categories:\n${rubric}\n\n` +
    `Reply with ONLY a JSON object, no other text, in exactly this shape:\n` +
    `{${scoresShape},${critiqueShape},"comparison":"a short paragraph comparing all the photos"}`
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

/** Runs the AI judge for a match once everyone in it has submitted (2 for a
 *  duel, up to 4 for a group) and no verdict yet exists. Safe to call
 *  speculatively — it's a no-op if a verdict already exists, the key isn't
 *  configured, or the match isn't actually full. Scores/critiques every
 *  submitted photo independently — no AI-declared "winner"; that's derived
 *  downstream from combined AI+peer scores (computeMatchResult, weeks.js). */
async function runAiJudge(matchId) {
  if (!config.anthropicApiKey) return null;

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { submissions: true, participants: true, verdict: true, week: true } });
  if (!match || match.verdict || match.submissions.length < 2) return null;
  const occupiedSlots = match.participants.filter((p) => p.userId != null).length;
  if (match.submissions.length !== occupiedSlots) return null;
  const week = match.week;

  const labeled = match.submissions.slice(0, LABELS.length).map((submission, i) => ({ label: LABELS[i], submission }));
  const client = new Anthropic({ apiKey: config.anthropicApiKey });

  const content = [{ type: "text", text: buildPrompt(week, labeled) }];
  for (const { label, submission } of labeled) {
    content.push({ type: "text", text: `Photo ${label}:` });
    content.push(await imageBlock(submission));
  }

  const response = await client.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 1536,
    messages: [{ role: "user", content }],
  });

  const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (err) {
    console.error(`[judge] failed to parse response for match ${match.id} (week ${week.number}):`, text);
    return null;
  }

  const scores = {};
  const critique = { comparison: parsed.comparison };
  labeled.forEach(({ label, submission }) => {
    scores[submission.id] = parsed[`scores${label}`];
    critique[submission.id] = parsed[`critique${label}`];
  });

  return prisma.verdict.create({
    data: { matchId: match.id, source: "ai", judgeName: "Claude", critique, scores },
  });
}

module.exports = { runAiJudge };
