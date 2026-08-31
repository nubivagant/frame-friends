import React from "react";
import { Link } from "react-router-dom";
import { useGame } from "../GameContext";
import { Avatar, Countdown, TypeRow, SectionLabel, Photo } from "../components/Shared";
import { fmtDeadlineLabel } from "../game";

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
          <div className="eyebrow">
            This Week · S{cur.season} · W{String(cur.number).padStart(2, "0")}
          </div>
          <div className="serif italic rise" style={{ fontSize: 32, lineHeight: 1.1, marginTop: 8 }}>
            {headline}
          </div>
          <div className="muted" style={{ marginTop: 6, fontSize: 13, maxWidth: "56ch" }}>
            {sub}
          </div>
        </div>
        <Countdown deadline={cur.deadline} />
      </div>

      <div className="envelope rise" style={{ marginBottom: 28 }}>
        <div className="wax" />
        <div className="row" style={{ gap: 10, marginBottom: 18 }}>
          <TypeRow types={cur.types} />
        </div>
        <div className="headline-xl serif italic" style={{ maxWidth: "20ch" }}>
          {cur.brief}
        </div>
        <div className="muted" style={{ marginTop: 18, maxWidth: "60ch", fontSize: 14, lineHeight: 1.6 }}>
          {cur.inspiration}
        </div>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr", gap: 18, marginTop: 16 }}>
            <Photo src={mySub.photoUrl} ratio="4 / 5" label={<span>{meP.name}</span>} />
            <div className="vs-sep italic">vs</div>
            <Photo src={theirSub.photoUrl} ratio="4 / 5" label={<span>{them.name}</span>} />
          </div>
          <div className="row" style={{ marginTop: 16, justifyContent: "center" }}>
            <Link className="btn primary" to="/reveal">
              Open reveal & judging →
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 32, marginBottom: 48 }}>
        <div>
          <SectionLabel>Standings</SectionLabel>
          <div className="card" style={{ marginTop: 16 }}>
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
