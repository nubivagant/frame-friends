import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useGame } from "./GameContext";
import { TYPES } from "./game";
import { api } from "./api";
import { useTheme } from "./useTheme";

const NAV = [
  ["/", "Home"],
  ["/brief", "This Week"],
  ["/reveal", "Reveal"],
  ["/archive", "Archive"],
  ["/players", "Players"],
  ["/settings", "Settings"],
];

export default function Layout({ me, onLoggedOut, children }) {
  const { state } = useGame();

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <TopBar me={me} onLoggedOut={onLoggedOut} />
      {state && <FieldLog />}
      <main id="main-content" className="fade" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.5 14.5a8.5 8.5 0 1 1-9-11.9 7 7 0 0 0 9 11.9Z" />
    </svg>
  );
}

function TopBar({ me, onLoggedOut }) {
  const { state } = useGame();
  const cur = state?.currentWeek;
  const { isLight, toggle } = useTheme();

  async function logout() {
    await api.logout();
    onLoggedOut();
  }

  return (
    <header className="topbar">
      <NavLink to="/" className="brand" style={{ display: "flex" }} aria-label="Frame Friends, home">
        <span className="glyph" aria-hidden="true" />
        <span>Frame Friends</span>
        <span className="vs" aria-hidden="true">A·B</span>
      </NavLink>
      <nav className="nav" aria-label="Main">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="right">
        {cur && (
          <>
            <span className="tick" aria-hidden="true">▲</span>
            <span>
              FLD-{String(cur.season).padStart(2, "0")}/{String(cur.number).padStart(2, "0")}
            </span>
            <span className="dot-sep" aria-hidden="true">·</span>
            {state.players.map((p, i) => {
              const sub = cur.submissions.find((s) => s.userId === p.id);
              return (
                <React.Fragment key={p.id}>
                  <span style={{ color: sub ? "var(--t-emotion)" : "var(--muted)" }}>
                    <span aria-hidden="true">{sub ? "● " : "○ "}</span>
                    {p.name.toUpperCase()} · {sub ? "sealed" : "pending"}
                  </span>
                  {i === 0 && <span className="dot-sep" aria-hidden="true">·</span>}
                </React.Fragment>
              );
            })}
            <span className="dot-sep" aria-hidden="true">·</span>
          </>
        )}
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-pressed={isLight}
          aria-label={isLight ? "Switch to dark mode" : "Switch to day mode"}
          title={isLight ? "Switch to dark mode" : "Switch to day mode"}
        >
          {isLight ? <MoonIcon /> : <SunIcon />}
        </button>
        <button className="btn ghost" style={{ padding: "4px 10px" }} onClick={logout}>
          {me.name} · Log out
        </button>
      </div>
    </header>
  );
}

function FieldLog() {
  const { state } = useGame();
  const cur = state.currentWeek;
  const [now] = useState(() => new Date());
  return (
    <div style={{ padding: "10px 28px 0" }}>
      <div className="field-log">
        <span className="tick" aria-hidden="true">▲</span>
        <strong>Field Log</strong>
        <span className="sep" aria-hidden="true">/</span>
        <span>
          S{String(cur.season).padStart(2, "0")} · Round {cur.number}
        </span>
        <span className="sep" aria-hidden="true">/</span>
        {state.players.map((p) => (
          <span key={p.id}>{p.name}</span>
        ))}
        <span className="sep" aria-hidden="true">/</span>
        <span>{now.toLocaleString()}</span>
        <span className="sep" aria-hidden="true">/</span>
        <span>
          Bearing: <span style={{ color: "var(--ink-2)" }}>{cur.types.map((t) => TYPES[t].name).join(" × ").toUpperCase()}</span>
        </span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--line)",
        marginTop: "auto",
        padding: "28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        fontFamily: "var(--mono)",
        fontSize: 11,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      <span>Frame Friends · Private edition for two</span>
      <span>"Two friends learning how they see"</span>
    </footer>
  );
}
