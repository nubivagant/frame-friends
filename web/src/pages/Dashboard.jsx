import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { Avatar, Countdown, TypeRow, SectionLabel, Photo } from "../components/Shared";
import { fmtDeadlineLabel } from "../game";
import { api } from "../api";

export default function Dashboard({ me }) {
  const { state, reload } = useGame();
  if (!state) return null;
  const cur = state.currentWeek;
  const match = state.myMatch;
  const meP = state.players.find((p) => p.id === me.id);
  const myStreak = meP?.standings?.participationStreak || 0;

  let headline, sub;
  const othersOutstanding = match ? match.totalCount - match.submittedCount - (match.mySubmitted ? 0 : 1) : 0;
  if (!match || match.isBye) {
    headline = "You're on the bench this week.";
    sub = state.joinableMatches.length
      ? "Someone's short a player — you can step in before the deadline."
      : `No pairing for you this round. Back in for the brief that opens ${fmtDeadlineLabel(cur.deadline)}.`;
  } else if (!match.mySubmitted) {
    headline = "Your move.";
    sub =
      othersOutstanding === 0
        ? `Everyone else has sealed their shot. The brief locks ${fmtDeadlineLabel(cur.deadline)}.`
        : `The brief locks ${fmtDeadlineLabel(cur.deadline)}.`;
  } else if (match.submittedCount < match.totalCount) {
    const waiting = match.totalCount - match.submittedCount;
    headline = `Sealed. Waiting on ${waiting} more.`;
    sub = `Reveal opens the moment everyone submits, or at ${fmtDeadlineLabel(cur.deadline)}.`;
  } else {
    headline = "Everyone's sealed. Reveal is open.";
    sub = match.totalCount > 2 ? "Rate everyone else's photo, or bring in a verdict." : "Rate each other's photo, or bring in a verdict.";
  }

  return (
    <div className="page">
      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
            <p className="eyebrow" style={{ margin: 0 }}>
              This Week · S{cur.season} · W{String(cur.number).padStart(2, "0")}
            </p>
            {myStreak > 0 && (
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".08em", color: "var(--hi-vis)" }} title="Your consecutive weeks submitted">
                🔥 {myStreak} week{myStreak === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <h1 className="serif italic rise" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 8, fontWeight: 400 }}>
            {headline}
          </h1>
          <p className="muted" style={{ marginTop: 6, fontSize: 13, maxWidth: "56ch" }}>
            {sub}
          </p>
          {match && !match.isBye && othersOutstanding > 0 && <NudgeButton />}
          {match && !match.isBye && match.canForfeit && <ForfeitButton match={match} reload={reload} />}
          {state.joinableMatches.length > 0 && (!match || match.isBye) && <JoinButtons matches={state.joinableMatches} reload={reload} />}
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
        {match && !match.isBye && (
          <div className="row between" style={{ marginTop: 28, gap: 16, flexWrap: "wrap" }}>
            <Link className="btn ghost" to="/brief">
              Read full brief
            </Link>
            {!match.mySubmitted ? (
              <Link className="btn primary lg" to="/upload">
                Submit your photo <span className="arrow">→</span>
              </Link>
            ) : (
              <Link className="btn ghost" to="/upload">
                Replace before lock →
              </Link>
            )}
          </div>
        )}
      </div>

      {match && match.revealed && !match.isBye && (
        <div style={{ marginBottom: 48 }}>
          <SectionLabel>Reveal · Week {String(cur.number).padStart(2, "0")}</SectionLabel>
          {match.submissions.length === 2 ? (
            <div className="grid-vs" style={{ marginTop: 16 }}>
              <Photo src={match.submissions.find((s) => s.userId === me.id)?.photoUrl} ratio="4 / 5" alt={`${meP.name}'s photo`} label={<span>{meP.name}</span>} />
              <div className="vs-sep italic" aria-hidden="true">vs</div>
              <Photo
                src={match.submissions.find((s) => s.userId !== me.id)?.photoUrl}
                ratio="4 / 5"
                alt={`${match.participants[0]?.name || "Opponent"}'s photo`}
                label={<span>{match.participants[0]?.name || "Opponent"}</span>}
              />
            </div>
          ) : (
            <div className="row" style={{ marginTop: 16, gap: 10, flexWrap: "wrap" }}>
              {match.submissions.map((s) => {
                const name = s.userId === me.id ? meP.name : match.participants.find((p) => p.id === s.userId)?.name || "Someone";
                return (
                  <div key={s.id} style={{ flex: "1 1 160px", minWidth: 140 }}>
                    <Photo src={s.photoUrl} ratio="4 / 5" alt={`${name}'s photo`} label={<span>{name}</span>} />
                  </div>
                );
              })}
            </div>
          )}
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

function NudgeButton() {
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
      setError(err.code === "rate_limited" ? "Already nudged them recently — give it a bit." : "Couldn't send that.");
    }
  }

  if (state === "sent") {
    return (
      <p className="muted" style={{ marginTop: 10, fontSize: 12 }} role="status">
        Nudged whoever's still out.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <button className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} disabled={state === "sending"} onClick={send}>
        {state === "sending" ? "…" : "Nudge whoever's outstanding"}
      </button>
      {state === "error" && (
        <p role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 11, marginTop: 6 }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ForfeitButton({ match, reload }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function forfeit() {
    setBusy(true);
    try {
      await api.forfeit(match.id);
      await reload();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <div style={{ marginTop: 8 }}>
        <button className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setConfirming(true)}>
          Forfeit this week
        </button>
      </div>
    );
  }

  return (
    <div className="row" style={{ marginTop: 8, gap: 8, alignItems: "center" }}>
      <span className="muted" style={{ fontSize: 12 }}>
        Sure? Someone else can step in for you.
      </span>
      <button className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} disabled={busy} onClick={forfeit}>
        {busy ? "…" : "Yes, forfeit"}
      </button>
      <button className="btn ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setConfirming(false)}>
        Never mind
      </button>
    </div>
  );
}

function JoinButtons({ matches, reload }) {
  const [busyId, setBusyId] = useState(null);

  async function join(matchId) {
    setBusyId(matchId);
    try {
      await api.joinMatch(matchId);
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ marginTop: 10 }}>
      {matches.map((m) => (
        <button
          key={m.id}
          className="btn primary"
          style={{ fontSize: 12, padding: "6px 14px", marginRight: 8 }}
          disabled={busyId === m.id}
          onClick={() => join(m.id)}
        >
          {busyId === m.id ? "…" : "Step in this week"}
        </button>
      ))}
    </div>
  );
}
