/**
 * DESIGN_SYSTEM.md §5 SegmentedControl (Discover). Sliding red pill under the active
 * segment (spring.pop), selection haptic. Content fade-swap is the consumer's job.
 */
import { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Press } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import { color, radius, space, type } from "@/lib/tokens";
import { dur, spring } from "@/theme/animations";

/**
 * `primary` — red pill, the main category switch. `subtle` — neutral pill + tighter
 * height, for a secondary filter that must read below a primary control (§5).
 */
type Variant = "primary" | "subtle";

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  variant = "primary",
}: {
  segments: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  variant?: Variant;
}) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const subtle = variant === "subtle";
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const segWidth = width > 0 ? (width - 8) / segments.length : 0;

  const x = useSharedValue(0);
  const target = index * segWidth;
  // Animate in an effect — never during render — so an unrelated re-render (e.g. a keystroke in the
  // consumer's search box) can't re-fire the pill spring.
  useEffect(() => {
    x.value = reduced ? withTiming(target, { duration: dur.fast }) : withSpring(target, spring.pop);
  }, [target, reduced, x]);
  const pillStyle = useAnimatedStyle(() => ({ width: segWidth, transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {segWidth > 0 && <Animated.View style={[styles.pill, subtle && styles.pillSubtle, pillStyle]} />}
      {segments.map((s) => (
        <Press
          key={s.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: s.key === value }}
          onPress={() => {
            haptics.selection();
            onChange(s.key);
          }}
          style={[styles.segment, subtle && styles.segmentSubtle]}
        >
          <Text style={[styles.label, subtle && styles.labelSubtle, s.key === value && styles.active]}>
            {s.label}
          </Text>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", backgroundColor: color.card, borderRadius: radius.input, padding: 4 },
  pill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.tileSm, backgroundColor: color.red },
  pillSubtle: { backgroundColor: color.border2 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(2.5) },
  segmentSubtle: { paddingVertical: space(1.75) },
  label: { fontFamily: type.heading.fontFamily, fontSize: 12, color: color.dim },
  labelSubtle: { fontSize: 11.5 },
  active: { color: color.text },
});
