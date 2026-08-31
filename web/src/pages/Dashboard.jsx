import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { Avatar, Countdown, TypeRow, SectionLabel, Photo } from "../components/Shared";
import { fmtDeadlineLabel } from "../game";
import { api } from "../api";

export default function Dashboard({ me }) {
  const { state } = useGame();
  if (!state) return null;
  const cur = state.currentWeek;
  const them = state.players.find((p) => p.id !== me.id);
  const meP = state.players.find((p) => p.id === me.id);
  const mySub = cur.submissions.find((s) => s.userId === me.id);
  const theirSub = cur.submissions.find((s) => s.userId === them.id);

  let headline, sub;
  if (!mySub) {
    headline = "Your move.";
    sub = theirSub
      ? `${them.name} already sealed their shot. The brief locks ${fmtDeadlineLabel(cur.deadline)}.`
      : `Neither of you has submitted yet. The brief locks ${fmtDeadlineLabel(cur.deadline)}.`;
  } else if (!theirSub) {
    headline = `Sealed. Waiting on ${them.name}.`;
    sub = `Reveal opens the moment you both submit, or at ${fmtDeadlineLabel(cur.deadline)}.`;
  } else {
    headline = "Both sealed. Reveal is open.";
    sub = "Rate each other's photo, or bring in a verdict.";
  }

  return (
    <div className="page">
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              This Week · S{cur.season} · W{String(cur.number).padStart(2, "0")}
            </p>
            {state.standings.participationStreak > 0 && (
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--hi-vis)" }} title="Consecutive weeks you've both submitted">
                🔥 {state.standings.participationStreak} week{state.standings.participationStreak === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <h1 className="serif italic rise" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 8, fontWeight: 400 }}>
            {headline}
          </h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13, maxWidth: "56ch" }}>
            {sub}
          </p>
          {!theirSub && <NudgeButton them={them} />}
        </div>
        <Countdown deadline={cur.deadline} />
      </div>

      <div className="envelope rise" style={{ marginBottom: 28 }}>
        <div className="wax" />
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <TypeRow types={cur.types} />
        </div>
        <p className="headline-xl serif italic" style={{ maxWidth: "20ch" }}>
          {cur.brief}
        </p>
        <p className="muted" style={{ marginTop: 18, maxWidth: "60ch", fontSize: 14, lineHeight: 1.6 }}>
          {cur.inspiration}
        </p>
        <div className="row between" style={{ marginTop: 28, gap: 16, flexWrap: "wrap" }}>
          <Link className="btn ghost" to="/brief">
            Read full brief
          </Link>
          {!mySub ? (
            <Link className="btn primary lg" to="/upload">
              Submit your photo <span className="arrow">→</span>
            </Link>
          ) : (
            <Link className="btn ghost" to="/upload">
              Replace before lock →
            </Link>
          )}
        </div>
      </div>

      {cur.revealed && (
        <div style={{ marginBottom: 48 }}>
          <SectionLabel>Reveal · Week {String(cur.number).padStart(2, "0")}</SectionLabel>
          <div className="grid-vs" style={{ marginTop: 16 }}>
            <Photo src={mySub.photoUrl} ratio="4 / 5" alt={`${meP.name}'s photo`} label={<span>{meP.name}</span>} />
            <div className="vs-sep italic" aria-hidden="true">vs</div>
            <Photo src={theirSub.photoUrl} ratio="4 / 5" alt={`${them.name}'s photo`} label={<span>{them.name}</span>} />
          </div>
          <div className="row" style={{ marginTop: 16, justifyContent: "center" }}>
            <Link className="btn primary" to="/reveal">
              Open reveal & judging →
            </Link>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 48 }}>
        <div>
          <SectionLabel>Standings</SectionLabel>
          <div className="card" style={{ marginTop: 16, maxWidth: 560 }}>
            {state.players.map((p, i) => (
              <div className="lb-row" key={p.id}>
                <span className="pos">{String(i + 1).padStart(2, "0")}</span>
                <div className="name">
                  <Avatar player={p} size="sm" />
                  {p.name}
                </div>
                <span className="mono muted" style={{ fontSize: 11 }}>
                  {p.standings.wins}W
                </span>
                <span className="serif" style={{ fontSize: 20 }}>
                  {p.standings.points}
                </span>
              </div>
            ))}
            <div className="divider" style={{ margin: "16px 0" }} />
            <div className="kv">
              <dt>Ties</dt>
              <dd>{state.standings.ties}</dd>
              {state.players.map((p) => (
                <React.Fragment key={p.id}>
                  <dt>{p.name} streak</dt>
                  <dd>
                    +{p.standings.streakNow} · best {p.standings.streakBest}
                  </dd>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NudgeButton({ them }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function send() {
    setState("sending");
    setError("");
    try {
      await api.nudge();
      setState("sent");
    } catch (err) {
      setState("error");
      setError(err.code === "rate_limited" ? `Already nudged ${them.name} recently — give it a bit.` : "Couldn't send that.");
    }
  }

  if (state === "sent") {
    return (
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }} role="status">
        Nudged {them.name}.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} disabled={state === "sending"} onClick={send}>
        {state === "sending" ? "…" : `Nudge ${them.name}`}
      </button>
      {state === "error" && (
        <p role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 11, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}
