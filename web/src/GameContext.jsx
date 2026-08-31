import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "./api";

const GameContext = createContext(null);

export function GameProvider({ children }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.state();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    reload();
    const onFocus = () => reload();
    const interval = setInterval(reload, 20000);
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  return <GameContext.Provider value={{ state, reload, error }}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used inside GameProvider");
  return ctx;
}
