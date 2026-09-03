import React, { useState } from "react";
import { SectionLabel } from "../components/Shared";
import { WEEKDAYS } from "../game";
import { useGame } from "../GameContext";
import { api } from "../api";
import { usePush } from "../usePush";

function NotificationsCard() {
  const { status, busy, enable, disable } = usePush();
  const [error, setError] = useState("");

  async function handleToggle() {
    setError("");
    try {
      if (status === "on") await disable();
      else await enable();
    } catch (err) {
      setError("Couldn't turn on notifications — try again.");
    }
  }

  const copy = {
    checking: "Checking…",
    unsupported: "This browser doesn't support notifications. On iPhone, add Frame Friends to your Home Screen first (Share → Add to Home Screen), then try from there.",
    denied: "Notifications are blocked for this site in your browser settings — nothing I can do from here to re-prompt you.",
    off: "Get a notification when the brief drops, when it's about to lock, when your partner nudges you, or when reveal is ready.",
    on: "Notifications are on for this browser/device.",
  }[status];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row between" style={{ gap: 16, flexWrap: "wrap" }}>
        <p className="muted" style={{ fontSize: 13, maxWidth: "50ch", margin: 0 }}>{copy}</p>
        {(status === "on" || status === "off") && (
          <button className="btn ghost" disabled={busy} onClick={handleToggle}>
            {busy ? "…" : status === "on" ? "Turn off" : "Enable notifications"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="muted" style={{ color: "var(--t-emotion)", fontSize: 12, marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function Settings({ me, onNameChanged }) {
  const { state, reload } = useGame();
  const [name, setName] = useState(me.name);
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!state) return null;
  const settings = cfg || state.settings;

  async function saveAll() {
    setBusy(true);
    setSaved(false);
    try {
      await Promise.all([
        api.updateSettings({
          deadlineDay: settings.deadlineDay,
          deadlineTime: settings.deadlineTime,
          briefDropDay: settings.briefDropDay,
          rerollTokensPerSeason: settings.rerollTokensPerSeason,
        }),
        name !== me.name ? api.updateMe({ name }) : Promise.resolve(),
      ]);
      await reload();
      if (name !== me.name) onNameChanged(name);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 920 }}>
      <div className="row between" style={{ marginBottom: 18 }}>
        <p className="eyebrow">Settings · The Frame Friends ruleset</p>
      </div>
      <h1 className="headline-l serif italic" style={{ marginBottom: 12 }}>
        How you all play the game.
      </h1>
      <p className="muted" style={{ maxWidth: "62ch", marginBottom: 36 }}>
        You're logged in as <strong>{me.name}</strong> ({me.email}).
      </p>

      <div className="grid-2">
        <div>
          <SectionLabel>Your name</SectionLabel>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="col" style={{ gap: 6 }}>
              <label className="eyebrow" htmlFor="settings-name">Display name</label>
              <input id="settings-name" className="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <SectionLabel>Cadence</SectionLabel>
          <div className="card" style={{ marginTop: 16 }}>
            <div className="col" style={{ gap: 6 }}>
              <label className="eyebrow" htmlFor="settings-drop-day">Brief drops</label>
              <select id="settings-drop-day" className="text" value={settings.briefDropDay} onChange={(e) => setCfg({ ...settings, briefDropDay: e.target.value })}>
                {WEEKDAYS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div className="col" style={{ gap: 6, marginTop: 14 }}>
              <span className="eyebrow" id="settings-lock-label">Submissions lock</span>
              <div className="row" role="group" aria-labelledby="settings-lock-label" style={{ gap: 10 }}>
                <label className="sr-only" htmlFor="settings-lock-day">Submissions lock day</label>
                <select id="settings-lock-day" className="text" style={{ flex: 2 }} value={settings.deadlineDay} onChange={(e) => setCfg({ ...settings, deadlineDay: e.target.value })}>
                  {WEEKDAYS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="settings-lock-time">Submissions lock time</label>
                <input id="settings-lock-time" className="text" style={{ flex: 1 }} value={settings.deadlineTime} onChange={(e) => setCfg({ ...settings, deadlineTime: e.target.value })} />
              </div>
              <p className="muted" style={{ fontSize: 11, margin: 0 }}>
                Both times are in London time, whichever timezone you're actually in.
              </p>
            </div>
            <div className="col" style={{ gap: 6, marginTop: 14 }}>
              <span className="eyebrow" id="settings-reroll-label">Reroll tokens per season</span>
              <div className="row" role="group" aria-labelledby="settings-reroll-label" style={{ gap: 6 }}>
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    aria-pressed={settings.rerollTokensPerSeason === n}
                    className="btn ghost"
                    style={{ flex: 1, justifyContent: "center", borderColor: settings.rerollTokensPerSeason === n ? "var(--ink)" : "var(--line)" }}
                    onClick={() => setCfg({ ...settings, rerollTokensPerSeason: n })}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <SectionLabel>Notifications</SectionLabel>
        <NotificationsCard />
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 36, alignItems: "center" }}>
        <span className="muted" role="status" aria-live="polite" style={{ fontSize: 12 }}>{saved ? "Saved." : ""}</span>
        <button className="btn primary" disabled={busy} onClick={saveAll}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
