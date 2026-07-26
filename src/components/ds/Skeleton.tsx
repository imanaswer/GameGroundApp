/** DESIGN_SYSTEM.md §4 / MOTION.md §7 Skeleton. Shimmer 1.3–1.4s, shaped like the real component. */
import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { color, radius, space } from "@/lib/tokens";

export function Skeleton({
  width = "100%",
  height = 14,
  round = radius.tileSm,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const shimmer = useSharedValue(0.4);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    shimmer.value = withRepeat(withTiming(0.75, { duration: 700 }), -1, true);
  }, [shimmer, reduced]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: color.card }, animatedStyle, style]} />;
}

/** Card-shaped skeleton: image block + 2 text lines + bar (§4). */
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height={118} round={radius.card} />
      <Skeleton width="70%" height={15} style={styles.line} />
      <Skeleton width="45%" height={12} style={styles.line} />
      <Skeleton height={5} round={999} style={styles.bar} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, padding: space(3.5), gap: space(2) },
  line: { marginTop: space(1) },
  bar: { marginTop: space(2) },
});
