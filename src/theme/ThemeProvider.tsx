/**
 * Appearance preference (Decision 24) — light, dark, or follow the system.
 *
 * The MODE is the user's choice and is persisted; the SCHEME is what that resolves to right now.
 * "system" is the default, and it is a live subscription, not a launch-time read: flipping the OS
 * switch while the app is open has to change the app, which is the whole reason `useColorScheme`
 * is a hook and not `Appearance.getColorScheme()`.
 *
 * The scheme reaches the theme runtime through a layout effect — before paint, so a switch never
 * shows a half-themed frame, and never during render, which would be a setState on an already
 * subscribed ancestor. The launch case needs no effect at all: the runtime seeds itself from the
 * OS at import.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import * as storage from "@/lib/storage";

import type { Scheme } from "./palette";
import { setActiveScheme } from "./runtime";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  /** What the user chose. */
  mode: ThemeMode;
  /** What that resolves to right now. */
  scheme: Scheme;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    storage
      .get("gg.themeMode")
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setModeState(saved);
      })
      .finally(() => setLoaded(true));
  }, []);

  const scheme: Scheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;

  /**
   * Applied in a LAYOUT effect, never during render. Notifying subscribers mid-render is a
   * setState-in-render on somebody else's component — `RootLayout` is already subscribed by the
   * time it renders this provider — and React says so loudly.
   *
   * There is no wrong-palette frame to trade away for that: the runtime seeds itself from the OS
   * at import, so "system" (the default) is correct before React starts, and a saved override is
   * applied by this effect, which runs before paint. `setActiveScheme` no-ops when unchanged, so
   * the common launch does nothing at all here.
   */
  useLayoutEffect(() => {
    setActiveScheme(scheme);
  }, [scheme]);

  const setMode = useMemo(
    () => (next: ThemeMode) => {
      setModeState(next);
      storage.set("gg.themeMode", next);
    },
    [],
  );

  const value = useMemo(() => ({ mode, scheme, setMode }), [mode, scheme, setMode]);

  /**
   * Hold the tree until the saved mode is known. The wait is one AsyncStorage read behind the
   * splash, and the alternative is visibly worse: a user who chose dark would watch the app paint
   * light and then correct itself on every single launch.
   */
  if (!loaded) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
