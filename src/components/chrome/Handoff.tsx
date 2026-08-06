/**
 * Post-auth handoff overlay — the brand loader that covers the gap between "you are signed in"
 * and the app being ready to look at (source's Sign up 09, used after login too).
 *
 * **It lives ABOVE the navigator, not inside a screen.** A screen that renders its own loader and
 * then navigates destroys it in the same commit, and any other redirect firing from underneath
 * destroys it too. Both happened, repeatedly. Mounted here as a sibling of the `<Stack>` — the
 * same place `<SplashGate />` sits — it simply cannot be raced: the screens below can mount,
 * unmount and swap freely while it holds.
 *
 * That also makes it do the job it was always meant to do. `begin()` then navigate: the tab tree
 * mounts and fires its queries BEHIND the loader (five tabs mount at launch, Decision 17) instead
 * of after it, so the hold covers real work rather than sitting in front of it.
 *
 * The hold is a floor, not a fabricated wait — that work can finish faster than the eye registers
 * a screen, and a loader nobody sees reads as a flicker. Touchable by default, so a stray tap
 * during the handoff cannot reach the screen mounting underneath.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BrandLoader } from "./BrandLoader";
import { dur, ease } from "@/theme/animations";

type HandoffContextValue = {
  /** Raise the loader, then navigate in the same handler. It clears itself. */
  begin: () => void;
};

const HandoffContext = createContext<HandoffContextValue | null>(null);

export function HandoffProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  const begin = useCallback(() => {
    opacity.value = 1;
    setActive(true);
  }, [opacity]);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      // §9 reduced motion: no fade, straight to the final state.
      if (reduced) return setActive(false);
      opacity.value = withTiming(0, { duration: dur.base, easing: ease.exit }, (finished) => {
        // Unmount rather than leave a transparent full-screen view swallowing touches.
        if (finished) runOnJS(setActive)(false);
      });
    }, dur.moment);
    return () => clearTimeout(timer);
  }, [active, reduced, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const value = useMemo(() => ({ begin }), [begin]);

  return (
    <HandoffContext.Provider value={value}>
      {children}
      {/* After `children` on purpose: later sibling paints on top of the whole navigator. */}
      {active && (
        <Animated.View style={[StyleSheet.absoluteFill, fade]}>
          <BrandLoader />
        </Animated.View>
      )}
    </HandoffContext.Provider>
  );
}

export function useHandoff(): HandoffContextValue {
  const ctx = useContext(HandoffContext);
  if (!ctx) throw new Error("useHandoff must be used inside <HandoffProvider>");
  return ctx;
}
