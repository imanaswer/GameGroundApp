/**
 * MOTION.md §2/§8 first-page list entrance: translateY 12→0 + fade, 30ms stagger by index.
 * First mount only (callers don't remount rows on pagination/back-nav). Reduced-motion renders
 * the final state immediately (§9).
 */
import { useEffect } from "react";
import type { ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { dur, ease } from "@/theme/animations";

const STAGGER_MS = 30;
const RISE = 12;

export function Appear({
  index = 0,
  style,
  children,
}: {
  /** Position in a list; drives the 30ms stagger. */
  index?: number;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(index * STAGGER_MS, withTiming(1, { duration: dur.slow, easing: ease.exit }));
  }, [reduced, index, p]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * RISE }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
