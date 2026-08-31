import React, { useEffect, useId, useState } from "react";
import { TYPES, CRITERIA, sumScores, emptyScores } from "../game";

export function TypeChip({ type, solid = false }) {
  const t = TYPES[type];
  if (!t) return null;
  return (
    <span className={`${solid ? "pill" : "chip"} t-${type}`}>
      <span className="dot" aria-hidden="true" />
      {t.name}
    </span>
  );
}

export function TypeRow({ types }) {
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      {types.map((t, i) => (
        <React.Fragment key={t}>
          <TypeChip type={t} />
          {i < types.length - 1 && (
            <span className="muted mono" style={{ fontSize: 10 }} aria-hidden="true">
              ×
            </span>
          )}
        </React.Fragment>
      ))}
    </span>
  );
}

export function Avatar({ player, size = "md" }) {
  if (!player) return null;
  return (
    <div className={`avatar size-${size} ${player.slug}`} role="img" aria-label={player.name}>
      <span aria-hidden="true">{player.name ? player.name[0].toUpperCase() : "?"}</span>
    </div>
  );
}

export function Photo({ src, alt, ratio = "4 / 5", corner, label, placeholderText, style, className = "" }) {
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio, ...style }}>
      {src ? (
        <img src={src} alt={alt || "Submitted photo"} loading="lazy" />
      ) : (
        <div className="ph-label">{placeholderText || "— No photo —"}</div>
      )}
      {corner && <div className="corner">{corner}</div>}
      {label && <div className="frame-label">{label}</div>}
    </div>
  );
}

function useCountdown(iso) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, new Date(iso) - now);
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff % 86400000) / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function Countdown({ deadline }) {
  const t = useCountdown(deadline);
  // A rapidly-ticking widget like this shouldn't be an aria-live region (it
  // would spam assistive tech every second) — instead expose one static-ish
  // role="timer" label and hide the fast-changing visual digits from AT.
  const label = `${t.d} days, ${t.h} hours, ${t.m} minutes, ${t.s} seconds until the deadline`;
  return (
    <div className="countdown" role="timer" aria-label={label}>
      <div className="seg" aria-hidden="true">
        <div className="n">{pad2(t.d)}</div>
        <div className="l">Days</div>
      </div>
      <div className="seg" aria-hidden="true">
        <div className="n">{pad2(t.h)}</div>
        <div className="l">Hrs</div>
      </div>
      <div className="seg" aria-hidden="true">
        <div className="n">{pad2(t.m)}</div>
        <div className="l">Min</div>
      </div>
      <div className="seg" aria-hidden="true">
        <div className="n">{pad2(t.s)}</div>
        <div className="l">Sec</div>
      </div>
    </div>
  );
}

export function Seal({ n, season, color = "var(--t-light)" }) {
  return (
    <div className="seal" style={{ color }} aria-hidden="true">
      <div className="top">Week</div>
      <div className="num">{pad2(n)}</div>
      <div className="bot">S{pad2(season)}</div>
    </div>
  );
}

export function SectionLabel({ children, as = "h2" }) {
  const Tag = as;
  return (
    <Tag className="section-label">
      <span>{children}</span>
      <span className="rule" aria-hidden="true" />
    </Tag>
  );
}

export function Toast({ text }) {
  if (!text) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {text}
    </div>
  );
}

export function RatingForm({ title, initial, saving, onSubmit }) {
  const [val, setVal] = useState(initial || { scores: emptyScores(), note: "" });
  const uid = useId();
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3 className="eyebrow" style={{ marginBottom: 14 }}>
        {title}
      </h3>
      <div className="col" style={{ gap: 10 }}>
        {CRITERIA.map((c) => {
          const inputId = `${uid}-${c.key}`;
          return (
            <div className="scoreslider" key={c.key}>
              <label className="label" htmlFor={inputId}>
                {c.label}
              </label>
              <input
                id={inputId}
                type="range"
                min={0}
                max={10}
                step={1}
                value={val.scores[c.key]}
                aria-valuetext={`${val.scores[c.key]} out of 10`}
                onChange={(e) => setVal({ ...val, scores: { ...val.scores, [c.key]: Number(e.target.value) } })}
              />
              <div aria-hidden="true" style={{ textAlign: "right" }}>{val.scores[c.key]}</div>
            </div>
          );
        })}
      </div>
      <div className="col" style={{ gap: 6, marginTop: 12 }}>
        <label className="eyebrow" htmlFor={`${uid}-note`}>
          Note <span className="muted">— optional</span>
        </label>
        <textarea
          id={`${uid}-note`}
          className="text"
          rows={2}
          placeholder="A short note on their photo"
          value={val.note}
          onChange={(e) => setVal({ ...val, note: e.target.value })}
        />
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Total: {sumScores(val.scores)} / 50
        </span>
        <button className="btn primary" disabled={saving} onClick={() => onSubmit(val)}>
          {saving ? "Saving…" : initial ? "Update rating" : "Submit rating"}
        </button>
      </div>
    </div>
  );
}
