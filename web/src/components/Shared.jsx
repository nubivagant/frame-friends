import React, { useEffect, useState } from "react";
import { TYPES, CRITERIA, sumScores, emptyScores } from "../game";

export function TypeChip({ type, solid = false }) {
  const t = TYPES[type];
  if (!t) return null;
  return (
    <span className={`${solid ? "pill" : "chip"} t-${type}`}>
      <span className="dot" />
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
            <span className="muted mono" style={{ fontSize: 10 }}>
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
    <div className={`avatar size-${size} ${player.slug}`} aria-label={player.name}>
      {player.name ? player.name[0].toUpperCase() : "?"}
    </div>
  );
}

export function Photo({ src, alt, ratio = "4 / 5", corner, label, placeholderText, style, className = "" }) {
  return (
    <div className={`photo ${className}`} style={{ aspectRatio: ratio, ...style }}>
      {src ? <img src={src} alt={alt || ""} loading="lazy" /> : <div className="ph-label">{placeholderText || "— No photo —"}</div>}
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
  return (
    <div className="countdown">
      <div className="seg">
        <div className="n">{pad2(t.d)}</div>
        <div className="l">Days</div>
      </div>
      <div className="seg">
        <div className="n">{pad2(t.h)}</div>
        <div className="l">Hrs</div>
      </div>
      <div className="seg">
        <div className="n">{pad2(t.m)}</div>
        <div className="l">Min</div>
      </div>
      <div className="seg">
        <div className="n">{pad2(t.s)}</div>
        <div className="l">Sec</div>
      </div>
    </div>
  );
}

export function Seal({ n, season, color = "var(--t-light)" }) {
  return (
    <div className="seal" style={{ color }}>
      <div className="top">Week</div>
      <div className="num">{pad2(n)}</div>
      <div className="bot">S{pad2(season)}</div>
    </div>
  );
}

export function SectionLabel({ children }) {
  return (
    <div className="section-label">
      <span>{children}</span>
      <span className="rule" />
    </div>
  );
}

export function Toast({ text }) {
  if (!text) return null;
  return <div className="toast">{text}</div>;
}

export function RatingForm({ title, initial, saving, onSubmit }) {
  const [val, setVal] = useState(initial || { scores: emptyScores(), note: "" });
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        {title}
      </div>
      <div className="col" style={{ gap: 10 }}>
        {CRITERIA.map((c) => (
          <div className="scoreslider" key={c.key}>
            <div className="label">{c.label}</div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={val.scores[c.key]}
              onChange={(e) => setVal({ ...val, scores: { ...val.scores, [c.key]: Number(e.target.value) } })}
            />
            <div style={{ textAlign: "right" }}>{val.scores[c.key]}</div>
          </div>
        ))}
      </div>
      <textarea
        className="text"
        rows={2}
        placeholder="A short note on their photo (optional)"
        style={{ marginTop: 12 }}
        value={val.note}
        onChange={(e) => setVal({ ...val, note: e.target.value })}
      />
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
