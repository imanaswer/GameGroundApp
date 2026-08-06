/**
 * The turning arc — DESIGN_SYSTEM §5. One implementation of the brand's loading ring, at any
 * size: 108pt inside `BrandLoader`'s black field, ~30pt in a screen that has already drawn its
 * chrome and is waiting on content (source's Account Setup 18).
 *
 * A three-quarter arc rather than a full circle, because a full circle rotating looks static.
 * `dur.slow` per revolution, linear — an eased spin reads as stuttering.
 *
 * It span at `dur.moment` (900ms) first and read as sluggish on device: 900ms is the tier-up
 * takeover's duration, a one-shot moment you watch, and a loop you glance at needs to look busier
 * than that. `dur.slow` is the next token down and the last one that still reads as a turn rather
 * than a blur — MOTION §1 admits no value between them, and inventing one needs a decision.
 *
 * Reduced motion keeps the arc as a static outline rather than removing it (§9): it is the
 * composition, not decoration on top of it, and something has to occupy the space.
 */
import { useEffect } from "react";
import { StyleSheet, type ColorValue, type StyleProp, type ViewStyle } from "react-native";
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

import { usePalette } from "@/theme/runtime";
import { dur } from "@/theme/animations";

/** Fraction of the circumference the stroke covers. */
const ARC = 0.72;

export function Spinner({
  size = 30,
  stroke = 2,
  tint,
  style,
  label = "Loading",
}: {
  size?: number;
  stroke?: number;
  tint?: ColorValue;
  style?: StyleProp<ViewStyle>;
  /** Announced to screen readers; give it context when the wait has a name. */
  label?: string;
}) {
  // Resolved from the hook, not a default parameter: a default is current but not reactive, and
  // the compiler will reuse this element's last output when its props have not changed.
  const palette = usePalette();
  const spin = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: dur.slow, easing: Easing.linear }), -1, false);
    // Loops never stop on their own — an orphaned repeat keeps the UI thread animating a node
    // that is no longer mounted.
    return () => cancelAnimation(spin);
  }, [reduced, spin]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <Animated.View
      style={[{ width: size, height: size }, style, !reduced && spinStyle]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint ?? palette.dim}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference * ARC} ${circumference}`}
          strokeLinecap="round"
          opacity={0.9}
        />
      </Svg>
    </Animated.View>
  );
}

/** The arc centred in whatever space it is given — a screen's content area, mid-load. */
export function SpinnerBlock({ minHeight = 240, label }: { minHeight?: number; label?: string }) {
  
  return (
    <Animated.View style={[styles.block, { minHeight }]}>
      <Spinner label={label} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { flex: 1, alignItems: "center", justifyContent: "center" },
});
