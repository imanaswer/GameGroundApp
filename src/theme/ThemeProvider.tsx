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
import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import * as storage from "@/lib/storage";

import { THEMES, type Scheme } from "./palette";
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

  /**
   * The white flash between screens.
   *
   * Under every React view there is a surface no style in this app reaches: the Android window's
   * decorView and the iOS UIWindow / root view controller. `app.config.js`'s `backgroundColor`
   * pins both to the LIGHT page (#FFFFFF) at build time, and it is a static value — it cannot
   * follow a runtime theme. That surface is normally hidden, but a transition uncovers it: the
   * frame between two pushed screens, a modal's exposed backdrop, an overscroll, a rotation. On
   * the dark palette that is a white flash, on every navigation.
   *
   * `contentStyle` on the navigator does not fix it — that paints the screen, and the gap is
   * *behind* the screen. This is the only API that reaches it, and it is why expo-system-ui's own
   * iOS module notes "without setting the window backgroundColor, native-stack modals will show
   * the wrong color".
   *
   * Both platforms persist the value natively and re-apply it on the next launch, so this pays the
   * native call once per scheme change rather than once per navigation. Fire-and-forget: a failure
   * here restores the old flash, it does not break a screen.
   */
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(THEMES[scheme].color.bg).catch(() => {});
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
