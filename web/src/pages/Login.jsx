import React, { useState } from "react";
import { api } from "../api";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("login"); // "login" | "forgot" | "sent"

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api.login(email, password);
      onLoggedIn(user);
    } catch (err) {
      setError(err.code === "invalid_credentials" ? "Wrong email or password." : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.requestLink(email);
      setMode("sent");
    } catch (err) {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-card">
        <p className="eyebrow">Frame Friends</p>
        <h1 className="headline-l serif italic" style={{ marginTop: 10 }}>
          {mode === "login" ? "Welcome back." : "Set or reset your password."}
        </h1>

        {mode === "sent" ? (
          <div className="card" style={{ marginTop: 24 }} role="status">
            <p className="muted">If that email is one of the two accounts on this game, a link just went out. It expires in an hour.</p>
            <button className="btn ghost" style={{ marginTop: 16 }} onClick={() => setMode("login")}>
              ← Back to login
            </button>
          </div>
        ) : (
          <form className="card col" style={{ marginTop: 24, gap: 14 }} onSubmit={mode === "login" ? submit : submitForgot}>
            <div className="col" style={{ gap: 6 }}>
              <label className="eyebrow" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className="text"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            {mode === "login" && (
              <div className="col" style={{ gap: 6 }}>
                <label className="eyebrow" htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  className="text"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            {error && (
              <div role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 13 }}>
                {error}
              </div>
            )}
            <button className="btn primary lg" disabled={busy} style={{ justifyContent: "center" }}>
              {busy ? "…" : mode === "login" ? "Log in" : "Send link"}
            </button>
            <button
              type="button"
              className="btn ghost"
              style={{ justifyContent: "center" }}
              onClick={() => setMode(mode === "login" ? "forgot" : "login")}
            >
              {mode === "login" ? "Forgot password / first time here" : "← Back to login"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
