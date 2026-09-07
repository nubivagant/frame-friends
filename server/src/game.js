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
  { primary: "light", brief: "Hard sun, and the shadow it casts", inspiration: "Midday light is unforgiving. Let it be. Don't wait for golden hour to bail you out — work with what falls hard and see what shape it throws." },
  { primary: "light", brief: "Golden hour, no faces", inspiration: "The best light of the day, spent on something that isn't a person. Everyone points a camera at a face when the light gets good — find the thing nobody else would bother with." },
  { primary: "light", brief: "A light source you can't see, only its effect", inspiration: "Photograph the glow, not the lamp. The source stays off-frame; you're chasing what it does to everything else — the wall it warms, the edge it catches." },
  { primary: "light", brief: "A window, at the exact moment it changes everything", inspiration: "Glass does strange things to a scene. Catch it mid-change — the second before a reflection resolves into something recognisable, or just after it stops being one." },
  { primary: "light", secondary: "mood", brief: "Neon, or nothing", inspiration: "Artificial colour, used on purpose. Not a stray sign caught in the background — let the neon be the reason the photo exists." },
  { primary: "light", secondary: "emotion", brief: "The last light in the room", inspiration: "Before the dark takes over completely. There's a specific minute where a room stops being lit and starts being remembered — find it before it's gone." },

  { primary: "motion", brief: "Something mid-fall", inspiration: "Gravity, caught in the act. The moment has no beginning or end you can point to — just the middle, which is exactly what makes it worth catching." },
  { primary: "motion", brief: "Blur as a decision, not an accident", inspiration: "Choose the blur. Don't apologise for it. A sharp photo you meant to take beats a blurry one you didn't — so mean it." },
  { primary: "motion", secondary: "narrative", brief: "The moment just after someone left the frame", inspiration: "Absence with momentum still in it. Something was just here — a chair still rocking, dust still settling — and the photo is proof, not memory." },
  { primary: "motion", brief: "A crowd, in motion, from one fixed point", inspiration: "Stand still. Let everything else move. The stillness of the camera is the whole trick — everything interesting happens around the one fixed thing in frame." },
  { primary: "motion", brief: "Speed you can feel in a still image", inspiration: "No video allowed — make the stillness lie. Convince someone looking at a frozen frame that something was actually moving fast through it." },
  { primary: "motion", secondary: "mood", brief: "Something that only exists for a second", inspiration: "A frame that couldn't have been planned. If you could set it up twice, it doesn't count — this brief rewards being ready, not being patient." },

  { primary: "emotion", brief: "Longing, without a person in frame", inspiration: "The feeling, none of the cause. An empty chair says more about who's missing than a portrait of them ever could." },
  { primary: "emotion", brief: "Joy, caught by accident", inspiration: "Not staged. Found. The second someone notices the camera, this brief is over — get it before that, or don't get it." },
  { primary: "emotion", brief: "An image that feels like relief", inspiration: "The exhale after something hard. Not the hard part itself — the moment right after, when the shoulders finally drop." },
  { primary: "emotion", secondary: "form", brief: "Tenderness, hidden in something ordinary", inspiration: "Care disguised as a boring object. A worn step, a mended sleeve — the unglamorous evidence that someone looked after something." },
  { primary: "emotion", brief: "Solitude that isn't sad", inspiration: "Alone, and completely fine about it. Most photos of one person read as lonely by default — fight that instinct." },
  { primary: "emotion", secondary: "constraint", brief: "Something you'd only photograph if you loved someone", inspiration: "Let the affection show without saying it. No captions doing the emotional work here — the photo has to earn it alone." },

  { primary: "street", brief: "A stranger's trace", inspiration: "Evidence of a life you'll never know. You're not photographing a person — you're photographing the shape they left behind." },
  { primary: "street", brief: "The city at an hour it doesn't perform for", inspiration: "Off-peak. Unguarded. Everywhere has a version of itself it only shows when it thinks nobody's looking — go find that hour." },
  { primary: "street", brief: "Something built for one purpose, used for another", inspiration: "Misuse, photographed with respect. Not mockery — genuine appreciation for whatever a place became instead of what it was designed to be." },
  { primary: "street", secondary: "narrative", brief: "A corner that knows something you don't", inspiration: "Give the place a secret. Nothing has to actually be happening — the photo just has to make someone believe it is." },
  { primary: "street", brief: "Public space, private moment", inspiration: "A moment that shouldn't belong out in the open, but does. The tension between the two is the whole picture." },
  { primary: "street", secondary: "emotion", brief: "Evidence someone was just here", inspiration: "The city, one beat behind a person who just left. You're always one step late to the actual event — make the aftermath count instead." },

  { primary: "form", brief: "Symmetry that isn't trying to be beautiful", inspiration: "Order for its own sake. Not the postcard kind of symmetrical — the kind that shows up in places that were never trying to look good." },
  { primary: "form", brief: "Repetition until it becomes something else", inspiration: "The same shape, enough times to stop being that shape. Somewhere past ten repeats, a window stops reading as a window." },
  { primary: "form", secondary: "constraint", brief: "A geometric image, within 500 metres of home", inspiration: "The city already gave you the shapes. Go find them. This one's a leash, not a limitation — you don't need to travel to find geometry." },
  { primary: "form", brief: "Texture, close enough to lose the subject", inspiration: "Get close enough that it stops being an object. Somewhere between recognisable and abstract is exactly where this brief lives." },
  { primary: "form", brief: "Two shapes that shouldn't work together, but do", inspiration: "An accidental pairing that reads as intentional. The city puts things next to each other that were never meant to meet — your job is to notice." },
  { primary: "form", secondary: "light", brief: "The architecture of something small", inspiration: "Structure exists at every scale. Find it small. A bottle cap has as much architecture in it as a building, if you get close enough to see it." },

  { primary: "narrative", brief: "An aftermath", inspiration: "Something happened here. Show what's left. The event is gone — the photo is a detective, not a witness." },
  { primary: "narrative", brief: "A picture that implies a question", inspiration: "Don't answer it. Just ask. The second the image explains itself, the question disappears — leave it open." },
  { primary: "narrative", secondary: "motion", brief: "Something mid-story, no beginning shown", inspiration: "Drop the viewer into the middle. No setup, no context — just the part where they have to catch up." },
  { primary: "narrative", brief: "A clue, photographed like evidence", inspiration: "Treat the frame like a case file. Whatever's in there should look like it matters to someone, even if you're the only one who knows why." },
  { primary: "narrative", brief: "The moment before something happens", inspiration: "Tension, not event. The thing itself is less interesting than the second right before it, when everyone can feel it coming." },
  { primary: "narrative", secondary: "mood", brief: "A secret, kept in plain sight", inspiration: "Hidden, but only if you're not looking. It should be obvious in hindsight and invisible on a first pass." },

  { primary: "constraint", brief: "One image. One colour.", inspiration: "Pick a colour before you leave the house. Commit before you know what you'll find — that's what makes it a constraint and not a filter." },
  { primary: "constraint", brief: "One lens, one hour, no do-overs", inspiration: "Constraint as a creative engine, not a punishment. Set the timer, pick the lens, and don't let yourself go back tomorrow for a better shot." },
  { primary: "constraint", brief: "Within reach of your front door", inspiration: "No travel. Just attention. The interesting thing was never the distance — it was whether you'd actually bothered to look." },
  { primary: "constraint", secondary: "form", brief: "No sky in the frame", inspiration: "Cut off the easiest part of the picture. Sky does half the work in most outdoor shots for free — this week, it doesn't get to." },
  { primary: "constraint", brief: "One block, whatever you find", inspiration: "The whole assignment is right outside. One block is either nowhere or everywhere, depending entirely on how closely you're willing to look." },
  { primary: "constraint", secondary: "emotion", brief: "Photograph care, without showing a person directly", inspiration: "An object, a corner, a residue — something that proves someone was looking out for someone else, without putting either of them in frame. The evidence has to do all the talking." },

  { primary: "mood", brief: "Cinematic, for no reason", inspiration: "Nothing is happening. Frame it like something is. Borrow the confidence of a movie still for a scene that's actually just Tuesday." },
  { primary: "mood", brief: "An image that feels like a held breath", inspiration: "Tension without release. The photo should feel like it's waiting for something that never quite arrives." },
  { primary: "mood", secondary: "light", brief: "Eerie, in daylight", inspiration: "Unsettling doesn't need darkness. Full sun can be just as wrong as midnight, if you find the thing that shouldn't be there." },
  { primary: "mood", brief: "Something quiet that's actually loud", inspiration: "Volume, without sound. Find the visual equivalent of something shouting, in a frame where nothing is making any noise at all." },
  { primary: "mood", secondary: "emotion", brief: "A picture that feels like 2am, even if it isn't", inspiration: "Borrow the hour's mood, not its light. You can shoot this at noon — just make it feel like the loneliest hour of the night." },
  { primary: "mood", brief: "Surreal, without editing", inspiration: "Find the strange. Don't manufacture it. The world produces enough genuine weirdness on its own — no filters needed, just attention." },
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

/** Like nextOccurrence, but skips ahead an extra (cadenceWeeks - 1) weeks —
 *  same weekday/time each round, just further apart. cadenceWeeks: 1 for
 *  weekly (identical to nextOccurrence), 2 for fortnightly, etc. */
function nextOccurrenceWithCadence(from, dayName, timeStr, cadenceWeeks) {
  const candidate = nextOccurrence(from, dayName, timeStr);
  const extraWeeks = Math.max(1, cadenceWeeks || 1) - 1;
  return extraWeeks > 0 ? new Date(candidate.getTime() + extraWeeks * 7 * 86400000) : candidate;
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
  nextOccurrenceWithCadence,
  londonPartsAt,
};
