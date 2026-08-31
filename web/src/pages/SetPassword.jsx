import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

export default function SetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (password.length < 8) return setError("Password needs to be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError("");
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.code === "invalid_or_expired_token" ? "That link has expired — request a new one from the login page." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="eyebrow">Frame Friends</div>
        <div className="headline-l serif italic" style={{ marginTop: 10 }}>
          Choose a password.
        </div>
        {done ? (
          <div className="card" style={{ marginTop: 24 }}>
            <p className="muted">Password set. You can log in now.</p>
            <button className="btn primary" style={{ marginTop: 16 }} onClick={() => navigate("/login")}>
              Go to login →
            </button>
          </div>
        ) : (
          <form className="card col" style={{ marginTop: 24, gap: 14 }} onSubmit={submit}>
            <div className="col" style={{ gap: 6 }}>
              <label className="eyebrow">New password</label>
              <input className="text" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            </div>
            <div className="col" style={{ gap: 6 }}>
              <label className="eyebrow">Confirm password</label>
              <input className="text" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            {error && (
              <div className="muted" style={{ color: "var(--t-emotion)", fontSize: 13 }}>
                {error}
              </div>
            )}
            <button className="btn primary lg" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "…" : "Set password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
