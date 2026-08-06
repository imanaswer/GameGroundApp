/** DESIGN_SYSTEM.md §4 Button. Variants: primary / secondary / ghost / mini. */
import {
  ActivityIndicator,
  type GestureResponderEvent,
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

import { cloneElement, isValidElement } from "react";

import * as haptics from "@/lib/haptics";
import { color, radius, space, type } from "@/lib/tokens";
import { dur } from "@/theme/animations";

import { Press } from "./Press";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

type Variant = "primary" | "secondary" | "ghost" | "mini";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** E2E hook (.maestro/). Press extends PressableProps so it forwards this natively. */
  testID?: string;
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
  testID,
}: Props) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const isPrimary = variant === "primary";
  const off = disabled || loading;

  /**
   * The button owns its icon's colour, because only the button knows its own fill.
   *
   * Call sites were passing `color.text` — correct on the old dark ground, and invisible on the
   * black pill the primary variant became. The Games FAB shipped a black plus on a black fill.
   * Overriding rather than defaulting is deliberate: a caller that "knows better" here is the
   * exact bug, and this failure mode is silent — a missing glyph reads as a design choice.
   */
  const onColor = off
    ? color.dim2
    : isPrimary || variant === "mini"
      ? color.onPrimary
      : variant === "ghost"
        ? color.dim
        : color.text;
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
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      // Scale-only compress. Redundant since Decision 16 made tilt opt-in, but kept explicit so a
      // future default flip can't silently reintroduce the iOS layer tearing on every button.
      tilt={false}
      onPressIn={onPressIn}
      onPress={() => {
        haptics.buttonPress();
        onPress();
      }}
      style={[
        styles.base,
        styles[variant],
        // Disabled is a fill+label swap, not a blanket opacity fade (Decision 20): the source
        // ships explicit disabled fills, and fading a black pill on white just makes it grey
        // anyway — but fading an OUTLINED pill makes its border disappear entirely.
        off && styles[`${variant}Disabled`],
        style,
      ]}
    >
      {isPrimary && !reduced && <Animated.View pointerEvents="none" style={[styles.ripple, rippleStyle]} />}
      <View style={styles.row}>
        {loading ? (
          // On a black fill the spinner must be white; on white/ghost it must be dark.
          <ActivityIndicator color={onColor} />
        ) : (
          <>
            {isValidElement<{ color?: string }>(icon) ? cloneElement(icon, { color: onColor }) : icon}
            <Text style={[styles.label, styles[`${variant}Label`], off && styles.labelDisabled]}>
              {title}
            </Text>
          </>
        )}
      </View>
    </Press>
  );
}

/**
 * Ported from the source's CTA Button (Decision 20). Two colours — black (primary) and white
 * (secondary, outlined) — two sizes, fully-rounded. The old radius-16 family is gone: every
 * button in the source is a pill.
 *
 * Heights are the source's measured symbol sizes: md 44, sm 33.
 */
const H_MD = 44;
const H_SM = 33;

const sheets = themed(() => ({
  base: { alignItems: "center", justifyContent: "center", minHeight: H_MD, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space(2) },
  ripple: {
    position: "absolute",
    width: RIPPLE_SIZE,
    height: RIPPLE_SIZE,
    borderRadius: RIPPLE_SIZE / 2,
    // `onPrimary`, because the ripple only fires on the `primary` fill and has to be whatever
    // reads against it — white on light's black pill, black on dark's white one. A fixed white
    // ripple is invisible in dark, and `color.text` was invisible in light.
    backgroundColor: color.onPrimary,
  },

  primary: {
    backgroundColor: color.primary,
    borderRadius: radius.chip,
    height: H_MD,
    paddingHorizontal: space(6),
  },
  secondary: {
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: radius.chip,
    height: H_MD,
    paddingHorizontal: space(6),
  },
  ghost: { paddingVertical: space(2), paddingHorizontal: space(2), minHeight: 0 },
  mini: {
    backgroundColor: color.primary,
    borderRadius: radius.chip,
    minHeight: H_SM,
    height: H_SM,
    paddingHorizontal: space(4),
  },

  // Disabled fills, per the source's disabled row.
  primaryDisabled: { backgroundColor: color.border },
  secondaryDisabled: { backgroundColor: color.card, borderColor: color.border },
  ghostDisabled: { opacity: 0.5 },
  miniDisabled: { backgroundColor: color.border },

  label: { ...type.heading, color: color.text },
  // On the `primary` fill, so it follows `primary` across themes. NOT `inverse` (always white),
  // which was invisible on dark's white pill — reported on the login screen.
  primaryLabel: { color: color.onPrimary },
  secondaryLabel: { color: color.text },
  ghostLabel: { color: color.dim },
  miniLabel: { fontFamily: type.heading.fontFamily, fontSize: 12, color: color.onPrimary },
  labelDisabled: { color: color.dim2 },
}));
