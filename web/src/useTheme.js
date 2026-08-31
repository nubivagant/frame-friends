import { useCallback, useEffect, useState } from "react";

const KEY = "ff-theme"; // "light" | "dark" | null (null = follow system)

function apply(theme) {
  if (theme) document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
}

export function useTheme() {
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(KEY);
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try {
      if (next) localStorage.setItem(KEY, next);
      else localStorage.removeItem(KEY);
    } catch (e) {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    const systemPrefersLight = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const currentlyLight = theme === "light" || (theme === null && systemPrefersLight);
    setTheme(currentlyLight ? "dark" : "light");
  }, [theme, setTheme]);

  const systemPrefersLight = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  const isLight = theme === "light" || (theme === null && systemPrefersLight);

  return { theme, isLight, toggle };
}
