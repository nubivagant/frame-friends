import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { Photo, TypeRow, Seal, Avatar, RatingForm } from "../components/Shared";
import { sumScores } from "../game";
import { api } from "../api";

export default function Results({ me }) {
  const { state, reload } = useGame();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (!state) return null;
  const cur = state.currentWeek;

  if (!cur.revealed) {
    return (
      <div className="page" style={{ maxWidth: 640, textAlign: "center", paddingTop: 100 }}>
        <div className="eyebrow">Reveal · Week {String(cur.number).padStart(2, "0")}</div>
        <div className="headline-l serif italic" style={{ marginTop: 14 }}>
          Not revealed yet.
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          Reveal opens once both of you submit, or at the deadline.
        </p>
        <Link className="btn primary" style={{ marginTop: 24 }} to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const them = state.players.find((p) => p.id !== me.id);
  const meP = state.players.find((p) => p.id === me.id);
  const mySub = cur.submissions.find((s) => s.userId === me.id);
  const theirSub = cur.submissions.find((s) => s.userId === them.id);
  const myRating = cur.ratings.find((r) => r.raterId === me.id);
  const theirRating = cur.ratings.find((r) => r.raterId === them.id);
  const result = cur.result;
  const winnerPlayer = result.winnerSubmissionId != null ? state.players.find((p) => p.id === (result.winnerSubmissionId === mySub.id ? me.id : them.id)) : null;

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
        <div className="eyebrow">
          Results · Week {String(cur.number).padStart(2, "0")} · Season {cur.season}
        </div>
      </div>

      <div className="row between" style={{ alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div className="row" style={{ gap: 10, marginBottom: 12 }}>
            <TypeRow types={cur.types} />
          </div>
          <div className="headline-l serif italic" style={{ maxWidth: "26ch" }}>
            "{cur.brief}"
          </div>
        </div>
        <Seal n={cur.number} season={cur.season} color="var(--t-emotion)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 18, alignItems: "stretch", marginTop: 36 }}>
        <div className="col rise">
          <Photo
            src={mySub.photoUrl}
            ratio="4 / 5"
            label={
              <>
                <span>{mySub.title ? `"${mySub.title}"` : "Untitled"}</span>
                <span className="muted">{meP.name}</span>
              </>
            }
          />
          {result.winnerSubmissionId === mySub.id && (
            <div className="pill" style={{ color: "var(--t-light)", alignSelf: "flex-start" }}>
              Winner
            </div>
          )}
        </div>
        <div className="vs-sep italic">vs</div>
        <div className="col rise d2">
          <Photo
            src={theirSub.photoUrl}
            ratio="4 / 5"
            label={
              <>
                <span>{theirSub.title ? `"${theirSub.title}"` : "Untitled"}</span>
                <span className="muted">{them.name}</span>
              </>
            }
          />
          {result.winnerSubmissionId === theirSub.id && (
            <div className="pill" style={{ color: "var(--t-street)", alignSelf: "flex-start" }}>
              Winner
            </div>
          )}
        </div>
      </div>

      {cur.verdict && (
        <div className="card" style={{ marginTop: 40 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            {cur.verdict.judgeName}'s verdict
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <p className="serif" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {cur.verdict.critique[String(mySub.id)]}
            </p>
            <p className="serif" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
              {cur.verdict.critique[String(theirSub.id)]}
            </p>
          </div>
          <div className="divider" />
          <p className="serif italic" style={{ fontSize: 18 }}>
            {cur.verdict.critique.comparison}
          </p>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          Mutual rating — rate each other's photo
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            {theirRating && (
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                {them.name} rated your photo: {sumScores(theirRating.scores)} / 50
              </div>
            )}
            {!theirRating && <div className="muted" style={{ fontSize: 13 }}>Waiting on {them.name} to rate your photo.</div>}
          </div>
          <div>
            <RatingForm title={`Rate ${them.name}'s photo`} initial={myRating} saving={busy} onSubmit={submitRating} />
          </div>
        </div>
      </div>

      {!result.pending && (
        <div className="card" style={{ marginTop: 24, padding: 32 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            Standing result
          </div>
          <div className="row between" style={{ flexWrap: "wrap", gap: 24 }}>
            <div className="row" style={{ gap: 16 }}>
              {winnerPlayer && <Avatar player={winnerPlayer} size="lg" />}
              <div>
                <div className="eyebrow">This week</div>
                <div className="serif" style={{ fontSize: 32, marginTop: 4 }}>
                  {winnerPlayer ? `${winnerPlayer.name} wins` : "It's a tie"}
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  {result.scores[mySub.id] ?? 0} – {result.scores[theirSub.id] ?? 0}
                </div>
              </div>
            </div>
            {result.awards.length > 0 && (
              <div className="row" style={{ gap: 12 }}>
                {result.awards.map((a) => (
                  <div className="card flat" key={a} style={{ padding: "12px 16px", borderColor: "var(--line-2)" }}>
                    <div className="eyebrow" style={{ color: "var(--t-light)" }}>
                      Special Distinction
                    </div>
                    <div className="serif italic" style={{ fontSize: 18, marginTop: 4 }}>
                      "{a}"
                    </div>
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
