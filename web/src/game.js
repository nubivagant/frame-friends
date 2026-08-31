// Shared vocabulary the frontend needs for display — kept in sync by hand
// with server/src/game.js (types/criteria rarely change; the brief bank
// itself is server-only, the frontend never needs it).
export const TYPES = {
  light: { id: "light", name: "Light" },
  motion: { id: "motion", name: "Motion" },
  emotion: { id: "emotion", name: "Emotion" },
  street: { id: "street", name: "Street" },
  form: { id: "form", name: "Form" },
  narrative: { id: "narrative", name: "Narrative" },
  constraint: { id: "constraint", name: "Constraint" },
  mood: { id: "mood", name: "Mood" },
};
export const TYPE_IDS = Object.keys(TYPES);

export const CRITERIA = [
  { key: "interpretation", label: "Brief" },
  { key: "composition", label: "Composition" },
  { key: "mood", label: "Mood" },
  { key: "originality", label: "Originality" },
  { key: "execution", label: "Execution" },
];

export function sumScores(scores) {
  return CRITERIA.reduce((a, c) => a + (Number(scores[c.key]) || 0), 0);
}

export function emptyScores() {
  const o = {};
  CRITERIA.forEach((c) => (o[c.key] = 7));
  return o;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtDateLabel(iso) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "Europe/London" });
}

export function fmtDeadlineLabel(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { weekday: "long", timeZone: "Europe/London" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/London" });
  return `${day}, ${time} London`;
}

export { WEEKDAYS };
