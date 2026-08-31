import React, { useEffect, useState } from "react";
import { Photo, TypeChip, Avatar, SectionLabel } from "../components/Shared";
import { TYPE_IDS, fmtDateLabel } from "../game";
import { api } from "../api";
import { useGame } from "../GameContext";

export default function Archive() {
  const { state } = useGame();
  const [weeks, setWeeks] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    api.archive().then((d) => setWeeks(d.weeks));
  }, []);

  if (!weeks || !state) return null;
  const shown = filter === "all" ? weeks : weeks.filter((w) => w.types.includes(filter));

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
          All · {weeks.length}
        </button>
        {TYPE_IDS.map((t) => {
          const count = weeks.filter((w) => w.types.includes(t)).length;
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
        {shown.map((w) => (
          <li key={w.id}>
            <ArchiveCard week={w} players={state.players} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ArchiveCard({ week, players }) {
  const winnerPlayerId = week.result.winnerSubmissionId != null ? week.submissions.find((s) => s.id === week.result.winnerSubmissionId)?.userId : null;
  const winner = winnerPlayerId ? players.find((p) => p.id === winnerPlayerId) : null;

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row" style={{ gap: 6, alignItems: "stretch" }}>
        {week.submissions.map((s) => {
          const p = players.find((pl) => pl.id === s.userId);
          return (
            <div key={s.id} style={{ flex: 1, minWidth: 90 }}>
              <Photo
                src={s.photoUrl}
                ratio="4 / 5"
                alt={`${p ? p.name : "Player"}'s photo, week ${week.number}`}
                corner={week.result.winnerSubmissionId === s.id ? "WIN" : null}
              />
            </div>
          );
        })}
      </div>
      <div className="row between" style={{ marginTop: 4 }}>
        <span className="mono" style={{ fontSize: 10, letterSpacing: ".18em", color: "var(--muted)", textTransform: "uppercase" }}>
          W{String(week.number).padStart(2, "0")} · {fmtDateLabel(week.deadline)}
        </span>
        <TypeChip type={week.types[0]} />
      </div>
      <p className="serif italic" style={{ fontSize: 16, color: "var(--ink-2)", lineHeight: 1.3, margin: 0 }}>
        "{week.brief}"
      </p>
      <div className="row between" style={{ fontSize: 12, color: "var(--muted)" }}>
        <span>
          {week.result.pending
            ? "Unrated"
            : winner
            ? `${winner.name} · ${week.result.scores[week.result.winnerSubmissionId]}`
            : `Tie · ${Object.values(week.result.scores).join("–")}`}
        </span>
        {week.result.awards?.[0] && (
          <span className="serif italic" style={{ color: "var(--t-light)" }}>
            "{week.result.awards[0]}"
          </span>
        )}
      </div>
    </div>
  );
}
