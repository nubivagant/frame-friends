import React, { useEffect, useState } from "react";
import { Photo, TypeChip, Avatar, SectionLabel } from "../components/Shared";
import { TYPE_IDS, fmtDateLabel } from "../game";
import { api } from "../api";
import { useGame } from "../GameContext";

export default function Archive() {
  const { state } = useGame();
  const [matches, setMatches] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.archive().then((d) => setMatches(d.matches));
  }, []);

  if (!matches || !state) return null;
  const played = matches.filter((m) => m.playerAId && m.playerBId); // skip byes / never-filled forfeits
  const shown = filter === "all" ? played : played.filter((m) => m.week.types.includes(filter));

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 18 }}>
        <div>
          <p className="eyebrow">Archive · Season {state.currentWeek.season}</p>
          <h1 className="headline-l serif italic" style={{ marginTop: 10 }}>
            The duel record.
          </h1>
        </div>
      </div>

      <div className="row" role="group" aria-label="Filter archive by type" style={{ gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        <button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className="chip" style={{ cursor: "pointer", borderColor: filter === "all" ? "var(--ink)" : undefined }}>
          All · {played.length}
        </button>
        {TYPE_IDS.map((t) => {
          const count = played.filter((m) => m.week.types.includes(t)).length;
          if (!count) return null;
          return (
            <button key={t} onClick={() => setFilter(t)} aria-pressed={filter === t} className={`chip t-${t}`} style={{ cursor: "pointer", borderColor: filter === t ? "currentColor" : undefined }}>
              {t[0].toUpperCase() + t.slice(1)} · {count}
            </button>
          );
        })}
      </div>

      {!shown.length && (
        <p className="muted" style={{ textAlign: "center", padding: "60px 0" }}>
          No rounds here yet.
        </p>
      )}

      <ul className="archive-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {shown.map((m) => (
          <li key={m.id}>
            <ArchiveCard match={m} players={state.players} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchiveCard({ match, players }) {
  const winnerPlayerId = match.result.winnerSubmissionId != null ? match.submissions.find((s) => s.id === match.result.winnerSubmissionId)?.userId : null;
  const winner = winnerPlayerId ? players.find((p) => p.id === winnerPlayerId) : null;
  const playerA = players.find((p) => p.id === match.playerAId);
  const playerB = players.find((p) => p.id === match.playerBId);

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6, alignItems: "stretch" }}>
        {match.submissions.map((s) => {
          const p = players.find((pl) => pl.id === s.userId);
          return (
            <div key={s.id} style={{ flex: 1, minWidth: 90 }}>
              <Photo
                src={s.photoUrl}
                ratio="4 / 5"
                alt={`${p ? p.name : "Player"}'s photo, week ${match.week.number}`}
                corner={match.result.winnerSubmissionId === s.id ? "WIN" : null}
              />
            </div>
          );
        })}
      </div>
      <div className="row between" style={{ marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--muted)", textTransform: "uppercase" }}>
          W{String(match.week.number).padStart(2, "0")} · {fmtDateLabel(match.week.deadline)}
        </span>
        <TypeChip type={match.week.types[0]} />
      </div>
      <p className="serif italic" style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.3, margin: 0 }}>
        "{match.week.brief}"
      </p>
      <p className="muted" style={{ fontSize: 11, margin: 0 }}>
        {playerA?.name || "?"} vs {playerB?.name || "?"}
      </p>
      <div className="row between" style={{ fontSize: 12, color: "var(--muted)" }}>
        <span>
          {match.result.pending
            ? !match.finalizedAt
              ? "Scoring in progress"
              : "Unrated"
            : winner
            ? `${winner.name} · ${match.result.scores[match.result.winnerSubmissionId]}`
            : `Tie · ${Object.values(match.result.scores).join("–")}`}
        </span>
        {match.result.awards?.[0] && (
          <span className="serif italic" style={{ color: "var(--t-light)" }}>
            "{match.result.awards[0]}"
          </span>
        )}
      </div>
    </div>
  );
}
