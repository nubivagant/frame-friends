import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { Photo, TypeRow, Seal, Avatar, RatingForm } from "../components/Shared";
import { sumScores } from "../game";
import { api } from "../api";

const FINALIZE_DELAY_MS = 24 * 60 * 60 * 1000;

function hoursLeft(lockedAt) {
  if (!lockedAt) return null;
  const ms = new Date(lockedAt).getTime() + FINALIZE_DELAY_MS - Date.now();
  return Math.max(0, Math.ceil(ms / 3600000));
}

export default function Results({ me }) {
  const { state, reload } = useGame();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const cur = state.currentWeek;
  const match = state.myMatch;

  if (!match || match.isBye) {
    return (
      <div className="page" style={{ maxWidth: 640, textAlign: "center", paddingTop: 100 }}>
        <p className="eyebrow">Reveal · Week {String(cur.number).padStart(2, "0")}</p>
        <h1 className="headline-l serif italic" style={{ marginTop: 14 }}>
          No match this week.
        </h1>
        <p className="muted" style={{ marginTop: 12 }}>
          {state.joinableMatches.length ? "Someone's short a player — you can step in from the dashboard." : "You're on the bench this round."}
        </p>
        <Link className="btn primary" style={{ marginTop: 24 }} to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!match.revealed) {
    return (
      <div className="page" style={{ maxWidth: 640, textAlign: "center", paddingTop: 100 }}>
        <p className="eyebrow">Reveal · Week {String(cur.number).padStart(2, "0")}</p>
        <h1 className="headline-l serif italic" style={{ marginTop: 14 }}>
          Not revealed yet.
        </h1>
        <p className="muted" style={{ marginTop: 12 }}>
          Reveal opens once both of you submit, or at the deadline.
        </p>
        <Link className="btn primary" style={{ marginTop: 24 }} to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const them = match.opponent;
  const mySub = match.submissions.find((s) => s.userId === me.id);
  const theirSub = match.submissions.find((s) => s.userId !== me.id);
  const myRating = match.ratings.find((r) => r.raterId === me.id);
  const theirRating = them ? match.ratings.find((r) => r.raterId === them.id) : null;
  const result = match.result;
  const finalized = !!match.finalizedAt;
  const remainingHours = hoursLeft(match.lockedAt);
  const winnerPlayer = finalized && result.winnerSubmissionId != null ? (result.winnerSubmissionId === mySub.id ? me : them) : null;

  async function submitRating(val) {
    setBusy(true);
    try {
      await api.rate(val.scores, val.note);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 18 }}>
        <p className="eyebrow">
          Results · Week {String(cur.number).padStart(2, "0")} · Season {cur.season}
        </p>
      </div>

      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <TypeRow types={cur.types} />
          </div>
          <h1 className="headline-l serif italic" style={{ maxWidth: "26ch" }}>
            "{cur.brief}"
          </h1>
        </div>
        <Seal n={cur.number} season={cur.season} color="var(--t-emotion)" />
      </div>

      <div className="grid-vs" style={{ marginTop: 36 }}>
        <div className="col rise">
          <Photo
            src={mySub.photoUrl}
            ratio="4 / 5"
            alt={`Your photo${mySub.title ? `: "${mySub.title}"` : ""}`}
            label={
              <>
                <span>{mySub.title ? `"${mySub.title}"` : "Untitled"}</span>
                <span className="muted">You</span>
              </>
            }
          />
          {finalized && result.winnerSubmissionId === mySub.id && (
            <div className="pill" style={{ color: "var(--t-light)", alignSelf: "flex-start" }}>
              Winner
            </div>
          )}
        </div>
        <div className="vs-sep italic" aria-hidden="true">vs</div>
        <div className="col rise d2">
          <Photo
            src={theirSub?.photoUrl}
            ratio="4 / 5"
            alt={`${them?.name || "Opponent"}'s photo${theirSub?.title ? `: "${theirSub.title}"` : ""}`}
            label={
              <>
                <span>{theirSub?.title ? `"${theirSub.title}"` : "Untitled"}</span>
                <span className="muted">{them?.name || "Opponent"}</span>
              </>
            }
          />
          {finalized && theirSub && result.winnerSubmissionId === theirSub.id && (
            <div className="pill" style={{ color: "var(--t-street)", alignSelf: "flex-start" }}>
              Winner
            </div>
          )}
        </div>
      </div>

      {match.verdict && theirSub && (
        <div className="card" style={{ marginTop: 40 }}>
          <h2 className="eyebrow" style={{ marginBottom: 12 }}>
            {match.verdict.judgeName}'s verdict
          </h2>
          <div className="grid-2">
            <p className="serif" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {match.verdict.critique[String(mySub.id)]}
            </p>
            <p className="serif" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {match.verdict.critique[String(theirSub.id)]}
            </p>
          </div>
          <div className="divider" />
          <p className="serif italic" style={{ fontSize: 18 }}>
            {match.verdict.critique.comparison}
          </p>
        </div>
      )}

      {theirSub && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 className="eyebrow" style={{ marginBottom: 12 }}>
            Mutual rating — rate each other's photo
          </h2>
          {finalized ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Scoring's closed for this one — the final score already locked in.
            </p>
          ) : (
            <div className="grid-2">
              <div>
                {theirRating && (
                  <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                    {them.name} rated your photo: {sumScores(theirRating.scores)} / 50
                  </p>
                )}
                {!theirRating && <p className="muted" style={{ fontSize: 13 }}>Waiting on {them?.name || "your opponent"} to rate your photo.</p>}
              </div>
              <div>
                <RatingForm title={`Rate ${them?.name || "their"} photo`} initial={myRating} saving={busy} onSubmit={submitRating} />
              </div>
            </div>
          )}
        </div>
      )}

      {theirSub && !finalized && (
        <div className="card" style={{ marginTop: 24, padding: 24, textAlign: "center" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            Final score
          </p>
          <p className="serif italic" style={{ fontSize: 20 }}>
            {remainingHours === 0 ? "Locking in any moment now." : `Locks in ~${remainingHours}h — AI critique + your ratings combine then.`}
          </p>
        </div>
      )}

      {finalized && !result.pending && (
        <div className="card" style={{ marginTop: 24, padding: 32 }}>
          <h2 className="eyebrow" style={{ marginBottom: 12 }}>
            Standing result
          </h2>
          <div className="row between" style={{ flexWrap: "wrap", gap: 24 }}>
            <div className="row" style={{ gap: 16 }}>
              {winnerPlayer && <Avatar player={winnerPlayer} size="lg" />}
              <div>
                <p className="eyebrow">This week</p>
                <p className="serif" style={{ fontSize: 32, marginTop: 4 }}>
                  {winnerPlayer ? `${winnerPlayer.id === me.id ? "You win" : `${winnerPlayer.name} wins`}` : "It's a tie"}
                </p>
                <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {result.scores[mySub.id] ?? 0} – {theirSub ? result.scores[theirSub.id] ?? 0 : "—"}
                </p>
              </div>
            </div>
            {result.awards.length > 0 && (
              <div className="row" style={{ gap: 12 }}>
                {result.awards.map((a) => (
                  <div className="card flat" key={a} style={{ padding: "12px 16px", borderColor: "var(--line-2)" }}>
                    <p className="eyebrow" style={{ color: "var(--t-light)" }}>
                      Special Distinction
                    </p>
                    <p className="serif italic" style={{ fontSize: 18, marginTop: 4 }}>
                      "{a}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 36, justifyContent: "center", gap: 12 }}>
        <Link className="btn ghost" to="/archive">
          ← Open archive
        </Link>
        <Link className="btn primary" to="/">
          Back to this week <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
