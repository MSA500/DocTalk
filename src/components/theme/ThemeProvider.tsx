"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_COOKIE_MAX_AGE, type Theme } from "@/lib/theme-cookie";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeThemeCookie(theme: Theme) {
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

// Only consulted while no explicit choice exists yet (cookie or in-session
// toggle). useSyncExternalStore (getServerSnapshot always false, matching
// the server's "light" guess) avoids the hydration mismatch an effect +
// setState on mount would cause here — same pattern as PwaInstallProvider.
function subscribeToSystemTheme(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getFalse() {
  return false;
}

export function ThemeProvider({
  initialTheme,
  hasThemeCookie,
  children,
}: {
  initialTheme: Theme;
  hasThemeCookie: boolean;
  children: React.ReactNode;
}) {
  const [explicitTheme, setExplicitTheme] = useState<Theme | null>(hasThemeCookie ? initialTheme : null);
  const systemPrefersDark = useSyncExternalStore(subscribeToSystemTheme, getSystemPrefersDark, getFalse);
  const theme = explicitTheme ?? (systemPrefersDark ? "dark" : "light");

  const setTheme = useCallback((next: Theme) => {
    setExplicitTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    writeThemeCookie(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
