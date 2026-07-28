/**
 * MOTION.md §3 — universal touch compress. Every Pressable in the app routes through
 * this so the press physics live in exactly one place.
 *
 * §3 spec: 3D compress — perspective tilt (~2.4° rotateX) + scale .965 via spring.press;
 * release springs back. Cards additionally brighten their border (border → border2 / 12% white).
 * Icon buttons compress harder (scaleTo .90). Reduced-motion drops the transforms (§9).
 */
import { forwardRef } from "react";
import { AccessibilityInfo, Pressable, type PressableProps } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { color } from "@/lib/tokens";
import { spring } from "@/theme/animations";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  /** Icon buttons compress harder (.90 vs .965) per §3. */
  scaleTo?: number;
  /** §3 3D compress: perspective tilt on press. On by default; flat controls can opt out. */
  tilt?: boolean;
  /** §3 cards brighten their border on press (border → border2). Consumer sets borderWidth;
   *  Press owns the animated borderColor, so don't also set a static borderColor in `style`. */
  brighten?: boolean;
};

/** §3 perspective tilt angle and card border-brighten stops. */
const TILT_DEG = 2.4;
const PERSPECTIVE = 600;

export const Press = forwardRef<typeof Pressable, Props>(function Press(
  { scaleTo = 0.965, tilt = true, brighten = false, onPressIn, onPressOut, style, children, ...rest },
  ref,
) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => {
    // Reduced motion: no transforms; hold the card border at its rest tone.
    if (reduced) return brighten ? { borderColor: color.border } : {};

    const p = pressed.value;
    const scale = 1 - p * (1 - scaleTo);
    // Single literal shape keeps the transform union inferable; perspective with a 0° tilt is a no-op.
    const transform = [
      { perspective: PERSPECTIVE },
      { rotateX: `${(tilt ? p : 0) * TILT_DEG}deg` },
      { scale },
    ];

    return brighten
      ? { transform, borderColor: interpolateColor(p, [0, 1], [color.border, color.border2]) }
      : { transform };
  });

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
      // Animated props last so the press physics always win over static style.
      style={[style as never, animatedStyle]}
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
