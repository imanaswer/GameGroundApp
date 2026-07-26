/**
 * MOTION.md §8 count-up. Worklet-driven number ticker (Animated TextInput + animatedProps —
 * no JS-thread animation), cubic-out over ~800ms on first mount, tabular-nums to prevent
 * layout shift. Reduced-motion renders the final value immediately.
 */
import { useEffect } from "react";
import { StyleSheet, TextInput, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export function CountUp({
  value,
  style,
  prefix = "",
  suffix = "",
  duration = 800,
}: {
  value: number;
  style?: TextStyle | TextStyle[];
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const v = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    v.value = reduced ? value : withTiming(value, { duration, easing: Easing.out(Easing.cubic) });
  }, [value, reduced, duration, v]);

  const animatedProps = useAnimatedProps(() => {
    // Worklet: format on the UI thread. Integer ticker; the caller adds any %/₹/# affix.
    return { text: `${prefix}${Math.round(v.value)}${suffix}`, defaultValue: `${prefix}${value}${suffix}` } as never;
  });

  return (
    <AnimatedTextInput
      editable={false}
      accessible
      accessibilityLabel={`${prefix}${value}${suffix}`}
      underlineColorAndroid="transparent"
      style={[styles.base, style]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: 0, fontVariant: ["tabular-nums"] },
});
