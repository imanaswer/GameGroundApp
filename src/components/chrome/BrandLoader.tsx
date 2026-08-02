/**
 * Full-screen brand loader — the source's Sign up 09 frame: a black field, the mark centred, and
 * a thin arc turning around it.
 *
 * Deliberately DARK in a light app. It is the same surface as the splash (Decision 18), and the
 * source agrees: its own splash and this loader are the only two black screens in the file. Both
 * are moments where the app is not yet showing content, so they belong to the brand rather than
 * to the UI — which is exactly why inverting them with the rest of the port would have been wrong.
 *
 * Used for the handoff after signup, where a session has just been created and the app is about
 * to swap to the tabs. It covers a real wait; it must never be shown on a timer for effect.
 */
import { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { color } from "@/lib/tokens";
import { dur } from "@/theme/animations";

const MARK = require("@/assets/images/splash-icon.png");

const RING = 108;
const STROKE = 1.5;
const R = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function BrandLoader() {
  const spin = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: dur.moment, easing: Easing.linear }), -1, false);
    // Loops never stop on their own — an orphaned repeat keeps the UI thread animating a node
    // that is no longer mounted.
    return () => cancelAnimation(spin);
  }, [reduced, spin]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <View style={styles.field} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={styles.center}>
        {/* Reduced motion keeps the ring as a static outline rather than removing it: it is part
            of the composition, not decoration on top of it (§9). */}
        <Animated.View style={[styles.ring, !reduced && ringStyle]}>
          <Svg width={RING} height={RING}>
            <Circle
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              stroke={color.inverse}
              strokeWidth={STROKE}
              fill="none"
              // A three-quarter arc, so the rotation is legible. A full circle would look static.
              strokeDasharray={`${CIRCUMFERENCE * 0.72} ${CIRCUMFERENCE}`}
              strokeLinecap="round"
              opacity={0.9}
            />
          </Svg>
        </Animated.View>
        <Image source={MARK} style={styles.mark} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // `onInverse` is the token for true black. Not `bg` — this screen is deliberately not the page.
  field: { ...StyleSheet.absoluteFillObject, backgroundColor: color.onInverse, zIndex: 300 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", width: RING, height: RING },
  mark: { width: 52, height: 39 },
});
