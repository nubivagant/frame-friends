import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGame } from "../GameContext";
import { Photo, TypeRow, Countdown, Seal } from "../components/Shared";
import { fmtDeadlineLabel } from "../game";
import { api } from "../api";

export default function Upload({ me }) {
  const { state, reload } = useGame();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forceEdit, setForceEdit] = useState(false);

  if (!state) return null;
  const cur = state.currentWeek;
  const match = state.myMatch;

  if (!match || match.isBye) {
    return (
      <div className="page" style={{ maxWidth: 720, textAlign: "center", paddingTop: 100 }}>
        <p className="eyebrow">No match this week</p>
        <h1 className="headline-l serif italic" style={{ marginTop: 14 }}>
          Nothing to submit — you're on the bench.
        </h1>
        <button className="btn primary" style={{ marginTop: 24 }} onClick={() => navigate("/")}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const mySub = match.submissions.find((s) => s.userId === me.id);

  if (mySub && !forceEdit) {
    return (
      <div className="page" style={{ maxWidth: 720, textAlign: "center", paddingTop: 100 }}>
        <p className="eyebrow rise">Submission received</p>
        <h1 className="headline-l serif italic rise d1" style={{ marginTop: 14, marginBottom: 24 }}>
          Sealed. Held until everyone arrives.
        </h1>
        <div className="rise d2" style={{ display: "inline-block", margin: "0 auto" }}>
          <Seal n={cur.number} season={cur.season} color="var(--t-emotion)" />
        </div>
        <p className="muted rise d3" style={{ maxWidth: "44ch", margin: "28px auto 0", lineHeight: 1.7 }}>
          {match.submittedCount >= match.totalCount
            ? "Everyone's in — head to Reveal."
            : `Waiting on ${match.totalCount - match.submittedCount} more. Reveal opens the moment everyone's in, or at ${fmtDeadlineLabel(cur.deadline)}.`}
        </p>
        <div className="row rise d4" style={{ justifyContent: "center", gap: 10, marginTop: 36 }}>
          <button className="btn ghost" onClick={() => setForceEdit(true)}>
            Replace before deadline
          </button>
          <button className="btn primary" onClick={() => navigate(match.submittedCount >= match.totalCount ? "/reveal" : "/")}>
            {match.submittedCount >= match.totalCount ? "Open reveal" : "Back to dashboard"} <span className="arrow">→</span>
          </button>
        </div>
      </div>
    );
  }

  function onFile(f) {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("photo", file);
      fd.append("title", title);
      fd.append("caption", caption);
      fd.append("note", note);
      await api.submit(fd);
      await reload();
      setForceEdit(false);
    } catch (err) {
      setError(err.code === "deadline_passed" ? "The deadline just passed — this week has already rolled over." : "Couldn't submit — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <p className="eyebrow">
          Upload · Week {String(cur.number).padStart(2, "0")} · Playing as <span style={{ color: "var(--t-street)" }}>{me.name}</span>
        </p>
        <button className="btn ghost" onClick={() => navigate("/")}>
          ← Cancel
        </button>
      </div>
      <h1 className="serif italic" style={{ fontSize: 22, color: "var(--muted)", marginBottom: 6, fontWeight: 400 }}>
        "{cur.brief}"
      </h1>
      <div className="row" style={{ marginBottom: 28 }}>
        <TypeRow types={cur.types} />
      </div>

      <div className="grid-2-wide">
        <div className="col" style={{ gap: 14 }}>
          {previewUrl ? (
            <Photo src={previewUrl} ratio="4 / 5" alt="Your unconfirmed entry preview" corner="UNCONFIRMED · YOUR ENTRY" />
          ) : (
            <button type="button" className="dropzone" onClick={() => fileRef.current?.click()}>
              Click to choose a photo
            </button>
          )}
          <input
            ref={fileRef}
            id="photo-file-input"
            type="file"
            accept="image/*"
            aria-label="Choose a photo to submit"
            style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}
            onChange={(e) => onFile(e.target.files[0])}
          />
          {previewUrl && (
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              Replace photo
            </button>
          )}
        </div>
        <div className="col" style={{ gap: 18 }}>
          <div className="col" style={{ gap: 6 }}>
            <label className="eyebrow" htmlFor="photo-title">
              Title <span className="muted">— optional</span>
            </label>
            <input id="photo-title" className="text" placeholder="Untitled" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="col" style={{ gap: 6 }}>
            <label className="eyebrow" htmlFor="photo-caption">
              Artist's note <span className="muted">— optional, hidden until reveal</span>
            </label>
            <textarea id="photo-caption" className="text" rows={4} placeholder="Two sentences, if any. Why this picture, this week?" value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="col" style={{ gap: 6 }}>
            <label className="eyebrow" htmlFor="photo-where">Where</label>
            <input id="photo-where" className="text" placeholder="Where was this taken?" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="card flat" style={{ background: "var(--bg-2)", padding: 16 }}>
            <div className="kv">
              <dt>Round</dt>
              <dd>
                W{String(cur.number).padStart(2, "0")} · S{cur.season}
              </dd>
              <dt>Locks in</dt>
              <dd>
                <Countdown deadline={cur.deadline} />
              </dd>
            </div>
          </div>
          {error && (
            <div role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 12 }}>
              {error}
            </div>
          )}
          <div className="row between" style={{ marginTop: 4 }}>
            <button className="btn ghost" onClick={() => navigate("/")}>
              Save draft
            </button>
            <button className="btn primary lg" disabled={!file || busy} onClick={submit}>
              {busy ? "Sealing…" : "Submit & seal"} <span className="arrow">→</span>
            </button>
          </div>
          <div className="muted" style={{ fontSize: 11, textAlign: "right" }}>
            You can replace your image until {fmtDeadlineLabel(cur.deadline)}.
          </div>
        </div>
      </div>
    </div>
  );
}
