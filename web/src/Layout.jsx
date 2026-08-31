import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useGame } from "./GameContext";
import { TYPES } from "./game";
import { api } from "./api";

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
      <TopBar me={me} onLoggedOut={onLoggedOut} />
      {state && <FieldLog />}
      <div className="fade">{children}</div>
      <Footer />
    </div>
  );
}

function TopBar({ me, onLoggedOut }) {
  const { state } = useGame();
  const cur = state?.currentWeek;

  async function logout() {
    await api.logout();
    onLoggedOut();
  }

  return (
    <div className="topbar">
      <NavLink to="/" className="brand" style={{ display: "flex" }}>
        <span className="glyph" />
        <span>Frame Friends</span>
        <span className="vs">A·B</span>
      </NavLink>
      <div className="nav">
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
        ))}
      </div>
      <div className="right">
        {cur && (
          <>
            <span className="tick">▲</span>
            <span>
              FLD-{String(cur.season).padStart(2, "0")}/{String(cur.number).padStart(2, "0")}
            </span>
            <span className="dot-sep">·</span>
            {state.players.map((p, i) => {
              const sub = cur.submissions.find((s) => s.userId === p.id);
              return (
                <React.Fragment key={p.id}>
                  <span style={{ color: sub ? "var(--t-emotion)" : "var(--muted)" }}>
                    {sub ? "● " : "○ "}
                    {p.name.toUpperCase()} · {sub ? "sealed" : "pending"}
                  </span>
                  {i === 0 && <span className="dot-sep">·</span>}
                </React.Fragment>
              );
            })}
          </>
        )}
        <span className="dot-sep">·</span>
        <button className="btn ghost" style={{ padding: "4px 10px" }} onClick={logout}>
          {me.name} · Log out
        </button>
      </div>
    </div>
  );
}

function FieldLog() {
  const { state } = useGame();
  const cur = state.currentWeek;
  const [now] = useState(() => new Date());
  return (
    <div style={{ padding: "10px 28px 0" }}>
      <div className="field-log">
        <span className="tick">▲</span>
        <strong>Field Log</strong>
        <span className="sep">/</span>
        <span>
          S{String(cur.season).padStart(2, "0")} · Round {cur.number}
        </span>
        <span className="sep">/</span>
        {state.players.map((p) => (
          <span key={p.id}>{p.name}</span>
        ))}
        <span className="sep">/</span>
        <span>{now.toLocaleString()}</span>
        <span className="sep">/</span>
        <span>
          Bearing: <span style={{ color: "var(--ink-2)" }}>{cur.types.map((t) => TYPES[t].name).join(" × ").toUpperCase()}</span>
        </span>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <div
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
    </div>
  );
}
