/**
 * Cold-start splash overlay (Decision 18) — MOTION §1 tokens, DS §1.1 colors.
 *
 * Why this exists on top of `expo-splash-screen`: the native splash is compiled into the binary by
 * a config plugin, so it is invisible in Expo Go, and it does not replay on a JS reload. In
 * development that makes the launch mark effectively unreachable; in production, locally-bundled
 * fonts resolve fast enough that hiding on load can blink it past in under a frame.
 *
 * This overlay is a deliberate pixel-match of the native splash — same asset, same background
 * token, same per-platform mark width — so the two read as a single splash rather than a handoff.
 * It owns the timing: the native splash is dismissed the moment this paints, and this holds until
 * MIN_MS has elapsed since bundle evaluation, then fades and unmounts.
 *
 * Cold start only. Nothing here listens to AppState, so returning from the background does not
 * replay it — see Decision 18 for why that was rejected.
 */
import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { color } from "@/lib/tokens";
import { dur, ease } from "@/theme/animations";
import { themed, useThemedStyles } from "@/theme/runtime";

const MARK = require("@/assets/images/splash-icon.png");

/**
 * Must mirror `imageWidth` in app.config.js per platform — these two numbers are one decision in
 * two files, and a mismatch shows up as the mark changing size the instant the native splash is
 * dismissed. Sized so the artwork reads at ~28.5% of screen width (see app.config.js for why that
 * is under the reference's 33.5%); Android is smaller because Android 12+ masks the outer third
 * of its system splash.
 */
const MARK_SIZE = Platform.OS === "android" ? 100 : 140;

/** Minimum on-screen time, measured from bundle evaluation. A floor, not a fixed delay. */
const MIN_MS = 1200;
const launchedAt = Date.now();

export function SplashGate() {
  const styles = useThemedStyles(sheets);
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  /**
   * Hand off from the native splash only once this overlay has actually laid out. Dismissing it
   * earlier — on font load, say — races the first commit and can expose a frame of the app
   * underneath, which is the exact flash this component exists to prevent.
   */
  const handoff = useCallback(() => {
    // Already-hidden is not worth surfacing, and a rejection here has nothing left to recover.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const remaining = Math.max(0, MIN_MS - (Date.now() - launchedAt));
    const timer = setTimeout(() => {
      // §9 reduced motion: no fade, just go straight to the final state.
      if (reduced) {
        setVisible(false);
        return;
      }
      opacity.value = withTiming(0, { duration: dur.base, easing: ease.exit }, (finished) => {
        // Unmount rather than leaving a transparent full-screen view swallowing touches.
        if (finished) runOnJS(setVisible)(false);
      });
    }, remaining);
    return () => clearTimeout(timer);
  }, [reduced, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  // Touchable by default (no pointerEvents="none") so a tap during launch cannot reach and
  // accidentally trigger whatever screen is mounting underneath.
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.field, fade]} onLayout={handoff}>
      <Image source={MARK} style={styles.mark} contentFit="contain" />
    </Animated.View>
  );
}

const sheets = themed(() => ({
  // `splash`, not `bg`: this overlay continues the NATIVE splash, whose colour is compiled in
  // and cannot follow the theme. On the light page `bg` made a white field under a white mark.
  field: { backgroundColor: color.splash, alignItems: "center", justifyContent: "center" },
  mark: { width: MARK_SIZE, height: MARK_SIZE },
}));
