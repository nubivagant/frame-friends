import React, { useState } from "react";
import { SectionLabel } from "../components/Shared";
import { WEEKDAYS } from "../game";
import { useGame } from "../GameContext";
import { api } from "../api";

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
        How you two play the game.
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
                Both times are in London time, whichever timezone you two are actually in.
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

      <div className="row" style={{ justifyContent: "flex-end", gap: 10, marginTop: 36, alignItems: "center" }}>
        <span className="muted" role="status" aria-live="polite" style={{ fontSize: 12 }}>{saved ? "Saved." : ""}</span>
        <button className="btn primary" disabled={busy} onClick={saveAll}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
