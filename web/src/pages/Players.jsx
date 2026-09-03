import React, { useEffect, useState } from "react";
import { Avatar, SectionLabel } from "../components/Shared";
import { useGame } from "../GameContext";
import { api } from "../api";
import { fmtDateLabel } from "../game";

export default function Players({ me }) {
  const { state } = useGame();
  const [pid, setPid] = useState(me.id);
  const [matches, setMatches] = useState(null);

  useEffect(() => {
    api.archive().then((d) => setMatches(d.matches));
  }, []);

  if (!state) return null;
  const player = state.players.find((p) => p.id === pid);
  const accent = player.slug === "scott" ? "var(--t-emotion)" : "var(--t-street)";

  const mine = (matches || []).filter((m) => {
    const occupied = m.participants.filter((p) => p.userId != null);
    return occupied.length >= 2 && occupied.some((p) => p.userId === pid);
  });

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Player Card</p>
        <div className="row" role="group" aria-label="Choose a player" style={{ gap: 8 }}>
          {state.players.map((p) => (
            <button key={p.id} aria-pressed={pid === p.id} className="btn ghost" onClick={() => setPid(p.id)} style={{ borderColor: pid === p.id ? "var(--ink)" : "var(--line)" }}>
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
                <p className="eyebrow" style={{ color: accent }}>
                  {player.title}
                </p>
              )}
              <h1 className="serif" style={{ fontSize: 48, lineHeight: 1, letterSpacing: "-0.015em", marginTop: 8 }}>
                {player.name}
              </h1>
              {player.bio && (
                <p className="muted" style={{ marginTop: 8, fontSize: 13, maxWidth: "44ch", fontStyle: "italic" }}>
                  "{player.bio}"
                </p>
              )}
            </div>
          </div>
          <div className="grid-stats-4">
            <Stat v={player.standings.wins} l="Wins" />
            <Stat v={player.standings.points} l="Points" />
            <Stat v={player.standings.avg} l="Avg / 50" />
            <Stat v={player.standings.streakBest} l="Best streak" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 48, padding: 28 }}>
        <SectionLabel>Recent matches</SectionLabel>
        {matches == null && (
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            Loading…
          </p>
        )}
        {matches != null && !mine.length && (
          <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
            No revealed matches yet.
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          {mine.slice(0, 10).map((m) => {
            const mySub = m.submissions.find((s) => s.userId === pid);
            const opponents = m.participants.filter((p) => p.userId != null && p.userId !== pid).map((p) => state.players.find((pl) => pl.id === p.userId));
            const outcome = m.result.pending
              ? "Pending"
              : m.result.winnerSubmissionId == null
              ? "Tie"
              : mySub && m.result.winnerSubmissionId === mySub.id
              ? "Won"
              : "Lost";
            return (
              <div key={m.id} className="row between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row" style={{ gap: 10 }}>
                  {opponents[0] && <Avatar player={opponents[0]} size="xs" />}
                  <span style={{ fontSize: 13 }}>vs {opponents.map((p) => p?.name || "Unknown").join(", ")}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    W{String(m.week.number).padStart(2, "0")}
                  </span>
                </div>
                <span className="mono" style={{ fontSize: 12, color: outcome === "Won" ? "var(--t-light)" : outcome === "Lost" ? "var(--t-street)" : "var(--muted)" }}>
                  {outcome}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ v, l }) {
  return (
    <div className="stat" aria-label={`${v} ${l}`}>
      <div className="v" aria-hidden="true">{v}</div>
      <div className="l" aria-hidden="true">{l}</div>
    </div>
  );
}
