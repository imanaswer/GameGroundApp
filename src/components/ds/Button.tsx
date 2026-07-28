/** DESIGN_SYSTEM.md §4 Button. Variants: primary / secondary / ghost / mini. */
import {
  ActivityIndicator,
  type GestureResponderEvent,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/lib/haptics";
import { color, shadow, space, type } from "@/lib/tokens";
import { dur } from "@/theme/animations";

import { Press } from "./Press";

type Variant = "primary" | "secondary" | "ghost" | "mini";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** §3 ripple: white 35% expanding-fading disc from the touch point over 500ms (primary only). */
const RIPPLE_SIZE = 24;
const RIPPLE_SCALE = 14;

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const isPrimary = variant === "primary";
  const off = disabled || loading;
  const reduced = useReducedMotion();

  // Ripple state (worklet-driven). Only primary emits it.
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);
  const rProgress = useSharedValue(0);

  const rippleStyle = useAnimatedStyle(() => ({
    left: rx.value - RIPPLE_SIZE / 2,
    top: ry.value - RIPPLE_SIZE / 2,
    opacity: (1 - rProgress.value) * 0.35,
    transform: [{ scale: 0.1 + rProgress.value * RIPPLE_SCALE }],
  }));

  // Plain closure (not useCallback): shared values are stable refs and must stay mutable —
  // listing them as hook deps trips the React-Compiler immutability rule.
  const onPressIn = (e: GestureResponderEvent) => {
    if (!isPrimary || reduced) return;
    rx.value = e.nativeEvent.locationX;
    ry.value = e.nativeEvent.locationY;
    rProgress.value = 0;
    rProgress.value = withTiming(1, { duration: dur.slow, easing: Easing.out(Easing.cubic) });
  };

  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPressIn={onPressIn}
      onPress={() => {
        haptics.buttonPress();
        onPress();
      }}
      style={[
        styles.base,
        styles[variant],
        isPrimary && shadow.ctaRed,
        off && styles.disabled,
        style,
      ]}
    >
      {isPrimary && !reduced && <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />}
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? color.text : color.dim} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, styles[`${variant}Label`]]}>{title}</Text>
          </>
        )}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", minHeight: 44, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space(2) },
  disabled: { opacity: 0.5 },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    backgroundColor: color.text,
  },

  primary: { backgroundColor: color.red, borderRadius: 16, paddingVertical: space(3.5), paddingHorizontal: space(5) },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: 16,
    paddingVertical: space(3.5),
    paddingHorizontal: space(5),
  },
  ghost: { paddingVertical: space(2), paddingHorizontal: space(2) },
  mini: { backgroundColor: color.red, borderRadius: 11, minHeight: 34, paddingVertical: space(2.25), paddingHorizontal: space(3.75) },

  label: { ...type.heading, color: color.text },
  primaryLabel: { color: color.text },
  secondaryLabel: { color: color.text },
  ghostLabel: { color: color.dim },
  miniLabel: { fontFamily: type.heading.fontFamily, fontSize: 11.5, color: color.text },
});
