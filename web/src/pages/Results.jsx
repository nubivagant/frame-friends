import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { Photo, TypeRow, Seal, Avatar, RatingForm } from "../components/Shared";
import { sumScores } from "../game";
import { api } from "../api";

const FINALIZE_DELAY_MS = 24 * 60 * 60 * 1000;
const ORDINALS = ["1st", "2nd", "3rd", "4th"];

function hoursLeft(lockedAt) {
  if (!lockedAt) return null;
  const ms = new Date(lockedAt).getTime() + FINALIZE_DELAY_MS - Date.now();
  return Math.max(0, Math.ceil(ms / 3600000));
}

export default function Results({ me }) {
  const { state, reload } = useGame();
  const [busyId, setBusyId] = useState(null);
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
          Reveal opens once everyone submits, or at the deadline.
        </p>
        <Link className="btn primary" style={{ marginTop: 24 }} to="/">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const mySub = match.submissions.find((s) => s.userId === me.id);
  const otherSubs = match.submissions.filter((s) => s.userId !== me.id);
  const nameFor = (userId) => (userId === me.id ? "You" : match.participants.find((p) => p.id === userId)?.name || "Someone");
  const playerFor = (userId) => (userId === me.id ? me : match.participants.find((p) => p.id === userId));
  const result = match.result;
  const finalized = !!match.finalizedAt;
  const remainingHours = hoursLeft(match.lockedAt);
  const isDuel = match.submissions.length === 2;

  const ranked = finalized && !result.pending ? [...match.submissions].sort((a, b) => (result.scores[b.id] ?? 0) - (result.scores[a.id] ?? 0)) : [];

  async function submitRating(submissionId, val) {
    setBusyId(submissionId);
    try {
      await api.rate(submissionId, val.scores, val.note);
      await reload();
    } finally {
      setBusyId(null);
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

      {isDuel ? (
        <div className="grid-vs" style={{ marginTop: 36 }}>
          <PhotoCard sub={mySub} label="You" winner={finalized && result.winnerSubmissionId === mySub.id} accent="var(--t-light)" />
          <div className="vs-sep italic" aria-hidden="true">vs</div>
          <PhotoCard sub={otherSubs[0]} label={nameFor(otherSubs[0]?.userId)} winner={finalized && otherSubs[0] && result.winnerSubmissionId === otherSubs[0].id} accent="var(--t-street)" />
        </div>
      ) : (
        <div className="row" style={{ marginTop: 36, gap: 12, flexWrap: "wrap" }}>
          {match.submissions.map((s) => (
            <div key={s.id} style={{ flex: "1 1 200px", minWidth: 180 }}>
              <PhotoCard sub={s} label={nameFor(s.userId)} winner={finalized && result.winnerSubmissionId === s.id} accent="var(--t-light)" />
            </div>
          ))}
        </div>
      )}

      {match.verdict && (
        <div className="card" style={{ marginTop: 40 }}>
          <h2 className="eyebrow" style={{ marginBottom: 12 }}>
            {match.verdict.judgeName}'s verdict
          </h2>
          <div className={isDuel ? "grid-2" : "col"} style={{ gap: 16 }}>
            {match.submissions.map((s) => (
              <p key={s.id} className="serif" style={{ fontSize: 16, lineHeight: 1.5, color: "var(--ink-2)" }}>
                <strong>{nameFor(s.userId)}: </strong>
                {match.verdict.critique[String(s.id)]}
              </p>
            ))}
          </div>
          <div className="divider" />
          <p className="serif italic" style={{ fontSize: 18 }}>
            {match.verdict.critique.comparison}
          </p>
        </div>
      )}

      {otherSubs.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h2 className="eyebrow" style={{ marginBottom: 12 }}>
            Mutual rating — rate {otherSubs.length > 1 ? "everyone else's" : "each other's"} photo
          </h2>
          {finalized ? (
            <p className="muted" style={{ fontSize: 13 }}>
              Scoring's closed for this one — the final score already locked in.
            </p>
          ) : (
            <div className="col" style={{ gap: 20 }}>
              {otherSubs.map((sub) => {
                const theirRatingOfMine = mySub ? match.ratings.find((r) => r.raterId === sub.userId && r.submissionId === mySub.id) : null;
                const myRatingOfTheirs = match.ratings.find((r) => r.raterId === me.id && r.submissionId === sub.id);
                const name = nameFor(sub.userId);
                return (
                  <div key={sub.id} className="grid-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                    <div>
                      {theirRatingOfMine ? (
                        <p className="muted" style={{ fontSize: 13 }}>
                          {name} rated your photo: {sumScores(theirRatingOfMine.scores)} / 50
                        </p>
                      ) : (
                        <p className="muted" style={{ fontSize: 13 }}>Waiting on {name} to rate your photo.</p>
                      )}
                    </div>
                    <div>
                      <RatingForm title={`Rate ${name}'s photo`} initial={myRatingOfTheirs} saving={busyId === sub.id} onSubmit={(val) => submitRating(sub.id, val)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {otherSubs.length > 0 && !finalized && (
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
          {isDuel ? (
            (() => {
              const winnerPlayer = result.winnerSubmissionId != null ? playerFor(match.submissions.find((s) => s.id === result.winnerSubmissionId).userId) : null;
              return (
                <div className="row between" style={{ flexWrap: "wrap", gap: 24 }}>
                  <div className="row" style={{ gap: 16 }}>
                    {winnerPlayer && <Avatar player={winnerPlayer} size="lg" />}
                    <div>
                      <p className="eyebrow">This week</p>
                      <p className="serif" style={{ fontSize: 32, marginTop: 4 }}>
                        {winnerPlayer ? (winnerPlayer.id === me.id ? "You win" : `${winnerPlayer.name} wins`) : "It's a tie"}
                      </p>
                      <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                        {result.scores[mySub.id] ?? 0} – {otherSubs[0] ? result.scores[otherSubs[0].id] ?? 0 : "—"}
                      </p>
                    </div>
                  </div>
                  {result.awards.length > 0 && <AwardsRow awards={result.awards} />}
                </div>
              );
            })()
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {ranked.map((s, i) => (
                <div key={s.id} className="row between" style={{ alignItems: "center" }}>
                  <div className="row" style={{ gap: 12, alignItems: "center" }}>
                    <span className="mono" style={{ fontSize: 12, color: "var(--muted)", minWidth: 28 }}>
                      {ORDINALS[i] || `${i + 1}th`}
                    </span>
                    <Avatar player={playerFor(s.userId)} size="sm" />
                    <span className="serif" style={{ fontSize: 18 }}>
                      {s.userId === me.id ? "You" : nameFor(s.userId)}
                    </span>
                  </div>
                  <span className="mono" style={{ fontSize: 13 }}>{result.scores[s.id] ?? 0}</span>
                </div>
              ))}
              {result.awards.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <AwardsRow awards={result.awards} />
                </div>
              )}
            </div>
          )}
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

function PhotoCard({ sub, label, winner, accent }) {
  return (
    <div className="col rise">
      <Photo
        src={sub?.photoUrl}
        ratio="4 / 5"
        alt={`${label}'s photo${sub?.title ? `: "${sub.title}"` : ""}`}
        label={
          <>
            <span>{sub?.title ? `"${sub.title}"` : "Untitled"}</span>
            <span className="muted">{label}</span>
          </>
        }
      />
      {winner && (
        <div className="pill" style={{ color: accent, alignSelf: "flex-start" }}>
          Winner
        </div>
      )}
    </div>
  );
}

function AwardsRow({ awards }) {
  return (
    <div className="row" style={{ gap: 12 }}>
      {awards.map((a) => (
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
  );
}
