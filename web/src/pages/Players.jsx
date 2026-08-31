import React, { useState } from "react";
import { Avatar, SectionLabel } from "../components/Shared";
import { useGame } from "../GameContext";

export default function Players({ me }) {
  const { state } = useGame();
  const [pid, setPid] = useState(me.id);
  if (!state) return null;
  const player = state.players.find((p) => p.id === pid);
  const other = state.players.find((p) => p.id !== pid);
  const accent = player.slug === "scott" ? "var(--t-emotion)" : "var(--t-street)";

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 18 }}>
        <div className="eyebrow">Player Card</div>
        <div className="row" style={{ gap: 8 }}>
          {state.players.map((p) => (
            <button key={p.id} className="btn ghost" onClick={() => setPid(p.id)} style={{ borderColor: pid === p.id ? "var(--ink)" : "var(--line)" }}>
              <Avatar player={p} size="xs" /> {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 36, borderColor: "var(--line-2)" }}>
        <div className="row between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
          <div className="row" style={{ gap: 22, alignItems: "center" }}>
            <Avatar player={player} size="xl" />
            <div>
              {player.title && (
                <div className="eyebrow" style={{ color: accent }}>
                  {player.title}
                </div>
              )}
              <div className="serif" style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.015em", marginTop: 8 }}>
                {player.name}
              </div>
              {player.bio && (
                <div className="muted" style={{ marginTop: 8, fontSize: 13, maxWidth: "44ch", fontStyle: "italic" }}>
                  "{player.bio}"
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, auto)", gap: 32 }}>
            <Stat v={player.standings.wins} l="Wins" />
            <Stat v={player.standings.points} l="Points" />
            <Stat v={player.standings.avg} l="Avg / 50" />
            <Stat v={player.standings.streakBest} l="Best streak" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 48, padding: 28 }}>
        <SectionLabel>Head-to-head · {player.name} vs {other.name}</SectionLabel>
        <div className="row between" style={{ marginTop: 22, gap: 24, flexWrap: "wrap" }}>
          <div className="row" style={{ gap: 14 }}>
            <Avatar player={player} size="lg" />
            <div>
              <div className="eyebrow">{player.name}</div>
              <div className="serif" style={{ fontSize: 36 }}>
                {player.standings.wins}
                <span className="muted serif" style={{ fontSize: 24 }}> wins</span>
              </div>
            </div>
          </div>
          <div className="serif italic" style={{ fontSize: 28 }}>
            vs
          </div>
          <div className="row" style={{ gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div className="eyebrow">{other.name}</div>
              <div className="serif" style={{ fontSize: 36 }}>
                {other.standings.wins}
                <span className="muted serif" style={{ fontSize: 24 }}> wins</span>
              </div>
            </div>
            <Avatar player={other} size="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}
