import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { TypeRow, SectionLabel, Seal, Countdown } from "../components/Shared";
import { fmtDeadlineLabel } from "../game";
import { api } from "../api";

export default function Brief() {
  const { state, reload } = useGame();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!state) return null;
  const cur = state.currentWeek;
  const canReroll = cur.submissions.length === 0 && cur.rerollsUsedThisSeason < cur.rerollTokensPerSeason;

  async function reroll() {
    setBusy(true);
    setError("");
    try {
      await api.reroll();
      await reload();
    } catch (err) {
      setError(err.code === "no_rerolls_left" ? "No rerolls left this season." : "Couldn't reroll.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <p className="eyebrow">
          Brief · Week {String(cur.number).padStart(2, "0")} · Season {cur.season}
        </p>
        <Link className="btn ghost" to="/">
          ← Back to dashboard
        </Link>
      </div>
      <div className="row" style={{ gap: 14, marginBottom: 22 }}>
        <TypeRow types={cur.types} />
      </div>
      <h1 className="headline-xl serif italic rise" style={{ marginBottom: 28 }}>
        {cur.brief}
      </h1>

      <div className="grid-2-wide" style={{ marginTop: 36 }}>
        <div>
          <SectionLabel>From the Judge</SectionLabel>
          <p className="serif italic" style={{ fontSize: 20, lineHeight: 1.45, marginTop: 16, color: "var(--ink-2)", maxWidth: "44ch" }}>
            {cur.inspiration}
          </p>
          <div className="divider" />
          <SectionLabel>Rules of the Round</SectionLabel>
          <div className="kv" style={{ marginTop: 14 }}>
            <dt>Submissions</dt>
            <dd>One image per player</dd>
            <dt>Formats</dt>
            <dd>Any image file</dd>
            <dt>Captions</dt>
            <dd>Optional, hidden until reveal</dd>
            <dt>Replace</dt>
            <dd>Until {fmtDeadlineLabel(cur.deadline)}</dd>
            <dt>Judging</dt>
            <dd>Automatic AI verdict, plus mutual rating</dd>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="row between" style={{ alignItems: "flex-start" }}>
              <div>
                <div className="eyebrow">Submissions Lock</div>
                <div className="serif" style={{ fontSize: 28, marginTop: 6 }}>
                  {fmtDeadlineLabel(cur.deadline)}
                </div>
              </div>
              <Seal n={cur.number} season={cur.season} color="var(--t-emotion)" />
            </div>
            <div style={{ marginTop: 22 }}>
              <Countdown deadline={cur.deadline} />
            </div>
            <div className="divider" />
            <Link className="btn primary lg" style={{ width: "100%", justifyContent: "center" }} to="/upload">
              Enter your response <span className="arrow">→</span>
            </Link>
            <button
              className="btn ghost"
              disabled={!canReroll || busy}
              style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
              onClick={reroll}
            >
              Reroll the brief{" "}
              <span className="muted mono" style={{ fontSize: 10, letterSpacing: ".14em", marginLeft: 8 }}>
                {cur.rerollTokensPerSeason - cur.rerollsUsedThisSeason} LEFT THIS SEASON
              </span>
            </button>
            {error && (
              <div role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 12, marginTop: 8 }}>
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
