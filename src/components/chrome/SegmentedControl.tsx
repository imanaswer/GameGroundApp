/**
 * DESIGN_SYSTEM.md §5 SegmentedControl (Discover). Sliding red pill under the active
 * segment (spring.pop), selection haptic. Content fade-swap is the consumer's job.
 */
import { useState } from "react";
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

export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const index = Math.max(0, segments.findIndex((s) => s.key === value));
  const segWidth = width > 0 ? (width - 8) / segments.length : 0;

  const x = useSharedValue(0);
  const target = index * segWidth;
  x.value = reduced ? withTiming(target, { duration: dur.fast }) : withSpring(target, spring.pop);
  const pillStyle = useAnimatedStyle(() => ({ width: segWidth, transform: [{ translateX: x.value }] }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.container} onLayout={onLayout}>
      {segWidth > 0 && <Animated.View style={[styles.pill, pillStyle]} />}
      {segments.map((s) => (
        <Press
          key={s.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: s.key === value }}
          onPress={() => {
            haptics.selection();
            onChange(s.key);
          }}
          style={styles.segment}
        >
          <Text style={[styles.label, s.key === value && styles.active]}>{s.label}</Text>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", backgroundColor: color.card, borderRadius: radius.input, padding: 4 },
  pill: { position: "absolute", top: 4, bottom: 4, left: 4, borderRadius: radius.tileSm, backgroundColor: color.red },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: space(2.5) },
  label: { fontFamily: type.heading.fontFamily, fontSize: 12, color: color.dim },
  active: { color: color.text },
});
