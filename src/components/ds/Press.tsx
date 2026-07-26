/**
 * MOTION.md §3 — universal touch compress. Every Pressable in the app routes through
 * this so the press physics live in exactly one place (spring.press, scale .965).
 * Reduced-motion drops the scale (MOTION.md §9).
 */
import { forwardRef } from "react";
import { AccessibilityInfo } from "react-native";
import { Pressable, type PressableProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { spring } from "@/theme/animations";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** Icon buttons compress harder (.90 vs .965) per §3. */
  scaleTo?: number;
};

export const Press = forwardRef<typeof Pressable, Props>(function Press(
  { scaleTo = 0.965, onPressIn, onPressOut, style, children, ...rest },
  ref,
) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? 1 : 1 - pressed.value * (1 - scaleTo) }],
  }));

  return (
    <AnimatedPressable
      ref={ref as never}
      onPressIn={(e) => {
        pressed.value = withSpring(1, spring.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        pressed.value = withSpring(0, spring.press);
        onPressOut?.(e);
      }}
      style={[animatedStyle, style as never]}
      {...rest}
    >
      {children as never}
    </AnimatedPressable>
  );
});

/** One-shot reduced-motion read for non-worklet code paths (celebrations, staggers). */
export async function prefersReducedMotion(): Promise<boolean> {
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
}
