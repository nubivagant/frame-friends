// Core game domain logic — brief bank, type/criteria vocabulary, and the
// London-anchored scheduling math. Ported from the original Claude Artifact
// version (legacy/index.html); only the persistence layer changed.
"use strict";

const TYPES = {
  light: { id: "light", name: "Light", hint: "Hard sun, glow, shadow, night light" },
  motion: { id: "motion", name: "Motion", hint: "Blur, speed, passing moments" },
  emotion: { id: "emotion", name: "Emotion", hint: "Longing, tension, joy, solitude" },
  street: { id: "street", name: "Street", hint: "Fragments of the city, traces, signs" },
  form: { id: "form", name: "Form", hint: "Symmetry, repetition, geometry, texture" },
  narrative: { id: "narrative", name: "Narrative", hint: "Secrets, aftermath, waiting, clues" },
  constraint: { id: "constraint", name: "Constraint", hint: "One block, one colour, one lens, one hour" },
  mood: { id: "mood", name: "Mood", hint: "Cinematic, eerie, tender, surreal, quiet" },
};
const TYPE_IDS = Object.keys(TYPES);

const CRITERIA = [
  { key: "interpretation", label: "Brief" },
  { key: "composition", label: "Composition" },
  { key: "mood", label: "Mood" },
  { key: "originality", label: "Originality" },
  { key: "execution", label: "Execution" },
];

const BRIEF_BANK = [
  { primary: "light", brief: "Hard sun, and the shadow it casts", inspiration: "Midday light is unforgiving. Let it be." },
  { primary: "light", brief: "Golden hour, no faces", inspiration: "The best light of the day, spent on something that isn't a person." },
  { primary: "light", brief: "A light source you can't see, only its effect", inspiration: "Photograph the glow, not the lamp." },
  { primary: "light", brief: "A window, at the exact moment it changes everything", inspiration: "Glass does strange things to a scene. Catch it mid-change." },
  { primary: "light", secondary: "mood", brief: "Neon, or nothing", inspiration: "Artificial colour, used on purpose." },
  { primary: "light", secondary: "emotion", brief: "The last light in the room", inspiration: "Before the dark takes over completely." },

  { primary: "motion", brief: "Something mid-fall", inspiration: "Gravity, caught in the act." },
  { primary: "motion", brief: "Blur as a decision, not an accident", inspiration: "Choose the blur. Don't apologise for it." },
  { primary: "motion", secondary: "narrative", brief: "The moment just after someone left the frame", inspiration: "Absence with momentum still in it." },
  { primary: "motion", brief: "A crowd, in motion, from one fixed point", inspiration: "Stand still. Let everything else move." },
  { primary: "motion", brief: "Speed you can feel in a still image", inspiration: "No video allowed — make the stillness lie." },
  { primary: "motion", secondary: "mood", brief: "Something that only exists for a second", inspiration: "A frame that couldn't have been planned." },

  { primary: "emotion", brief: "Longing, without a person in frame", inspiration: "The feeling, none of the cause." },
  { primary: "emotion", brief: "Joy, caught by accident", inspiration: "Not staged. Found." },
  { primary: "emotion", brief: "An image that feels like relief", inspiration: "The exhale after something hard." },
  { primary: "emotion", secondary: "form", brief: "Tenderness, hidden in something ordinary", inspiration: "Care disguised as a boring object." },
  { primary: "emotion", brief: "Solitude that isn't sad", inspiration: "Alone, and completely fine about it." },
  { primary: "emotion", secondary: "constraint", brief: "Something you'd only photograph if you loved someone", inspiration: "Let the affection show without saying it." },

  { primary: "street", brief: "A stranger's trace", inspiration: "Evidence of a life you'll never know." },
  { primary: "street", brief: "The city at an hour it doesn't perform for", inspiration: "Off-peak. Unguarded." },
  { primary: "street", brief: "Something built for one purpose, used for another", inspiration: "Misuse, photographed with respect." },
  { primary: "street", secondary: "narrative", brief: "A corner that knows something you don't", inspiration: "Give the place a secret." },
  { primary: "street", brief: "Public space, private moment", inspiration: "A moment that shouldn't belong out in the open, but does." },
  { primary: "street", secondary: "emotion", brief: "Evidence someone was just here", inspiration: "The city, one beat behind a person who just left." },

  { primary: "form", brief: "Symmetry that isn't trying to be beautiful", inspiration: "Order for its own sake." },
  { primary: "form", brief: "Repetition until it becomes something else", inspiration: "The same shape, enough times to stop being that shape." },
  { primary: "form", secondary: "constraint", brief: "A geometric image, within 500 metres of home", inspiration: "The city already gave you the shapes. Go find them." },
  { primary: "form", brief: "Texture, close enough to lose the subject", inspiration: "Get close enough that it stops being an object." },
  { primary: "form", brief: "Two shapes that shouldn't work together, but do", inspiration: "An accidental pairing that reads as intentional." },
  { primary: "form", secondary: "light", brief: "The architecture of something small", inspiration: "Structure exists at every scale. Find it small." },

  { primary: "narrative", brief: "An aftermath", inspiration: "Something happened here. Show what's left." },
  { primary: "narrative", brief: "A picture that implies a question", inspiration: "Don't answer it. Just ask." },
  { primary: "narrative", secondary: "motion", brief: "Something mid-story, no beginning shown", inspiration: "Drop the viewer into the middle." },
  { primary: "narrative", brief: "A clue, photographed like evidence", inspiration: "Treat the frame like a case file." },
  { primary: "narrative", brief: "The moment before something happens", inspiration: "Tension, not event." },
  { primary: "narrative", secondary: "mood", brief: "A secret, kept in plain sight", inspiration: "Hidden, but only if you're not looking." },

  { primary: "constraint", brief: "One image. One colour.", inspiration: "Pick a colour before you leave the house." },
  { primary: "constraint", brief: "One lens, one hour, no do-overs", inspiration: "Constraint as a creative engine, not a punishment." },
  { primary: "constraint", brief: "Within reach of your front door", inspiration: "No travel. Just attention." },
  { primary: "constraint", secondary: "form", brief: "No sky in the frame", inspiration: "Cut off the easiest part of the picture." },
  { primary: "constraint", brief: "One block, whatever you find", inspiration: "The whole assignment is right outside." },
  { primary: "constraint", secondary: "emotion", brief: "Photograph care, without showing a person directly", inspiration: "An object, a corner, a residue. A picture that proves someone was looking out for someone else." },

  { primary: "mood", brief: "Cinematic, for no reason", inspiration: "Nothing is happening. Frame it like something is." },
  { primary: "mood", brief: "An image that feels like a held breath", inspiration: "Tension without release." },
  { primary: "mood", secondary: "light", brief: "Eerie, in daylight", inspiration: "Unsettling doesn't need darkness." },
  { primary: "mood", brief: "Something quiet that's actually loud", inspiration: "Volume, without sound." },
  { primary: "mood", secondary: "emotion", brief: "A picture that feels like 2am, even if it isn't", inspiration: "Borrow the hour's mood, not its light." },
  { primary: "mood", brief: "Surreal, without editing", inspiration: "Find the strange. Don't manufacture it." },
];

function pickBriefFor(recentPrimaries, excludeBrief) {
  let pool = BRIEF_BANK.filter((b) => {
    if (recentPrimaries.includes(b.primary)) return false;
    if (excludeBrief && b.brief === excludeBrief) return false;
    return true;
  });
  if (!pool.length) pool = BRIEF_BANK.filter((b) => b.brief !== excludeBrief);
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const types = pick.secondary ? [pick.primary, pick.secondary] : [pick.primary];
  return { types, brief: pick.brief, inspiration: pick.inspiration };
}

function sumScores(scores) {
  return CRITERIA.reduce((a, c) => a + (Number(scores[c.key]) || 0), 0);
}

function computeAwards(scoresWinner, scoresLoser) {
  if (!scoresWinner) return [];
  let best = null;
  let bestMargin = -Infinity;
  CRITERIA.forEach((c) => {
    const margin = (Number(scoresWinner[c.key]) || 0) - (scoresLoser ? Number(scoresLoser[c.key]) || 0 : 0);
    if (margin > bestMargin) {
      bestMargin = margin;
      best = c.label;
    }
  });
  return best ? [`Best ${best}`] : [];
}

/* --- London-anchored scheduling ---
   The two players can be in different timezones, so the weekly schedule
   needs one canonical clock rather than "whichever machine is running the
   check." Everything is anchored to Europe/London wall-clock time. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function londonPartsAt(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const o = {};
  fmt.formatToParts(date).forEach((p) => {
    if (p.type !== "literal") o[p.type] = p.value;
  });
  return o;
}

function londonWallToUTC(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0));
  const p = londonPartsAt(guess);
  const guessAsLondonWall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) === 24 ? 0 : Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  const offsetMs = guessAsLondonWall - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

function parseHHMM(timeStr) {
  const parts = (timeStr || "00:00").split(":");
  return { hh: Number(parts[0]) || 0, mm: Number(parts[1]) || 0 };
}

/** Next time `dayName`/`timeStr` occurs in London, strictly after `from`. */
function nextOccurrence(from, dayName, timeStr) {
  const t = parseHHMM(timeStr);
  let targetDow = WEEKDAYS.indexOf(dayName);
  if (targetDow < 0) targetDow = 0;
  const p = londonPartsAt(from);
  const wallDate = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const curDow = wallDate.getUTCDay();
  let diff = (targetDow - curDow + 7) % 7;
  let candidate = londonWallToUTC(Number(p.year), Number(p.month), Number(p.day) + diff, t.hh, t.mm);
  if (candidate <= from) candidate = londonWallToUTC(Number(p.year), Number(p.month), Number(p.day) + diff + 7, t.hh, t.mm);
  return candidate;
}

module.exports = {
  TYPES,
  TYPE_IDS,
  CRITERIA,
  BRIEF_BANK,
  pickBriefFor,
  sumScores,
  computeAwards,
  nextOccurrence,
  londonPartsAt,
};
