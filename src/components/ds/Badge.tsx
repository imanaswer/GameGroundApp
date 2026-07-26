/** DESIGN_SYSTEM.md §4 Badge / TierBadge / LiveChip. */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { color, space, tier as tierMap, type, type Tier } from "@/lib/tokens";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "red" }) {
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, tone === "neutral" ? styles.textNeutral : styles.textStrong]}>{label}</Text>
    </View>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  const t = tierMap[tier];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{tier}</Text>
    </View>
  );
}

/** FILLING FAST / live states: red bg, white text, pulsing 4px dot. */
export function LiveChip({ label }: { label: string }) {
  const pulse = useSharedValue(1);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      false,
    );
  }, [pulse, reduced]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.live}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Text style={styles.liveText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingVertical: space(0.75), paddingHorizontal: space(1.75), alignSelf: "flex-start" },
  neutral: { backgroundColor: color.card },
  success: { backgroundColor: color.successSurface },
  red: { backgroundColor: color.redSurface },
  text: { fontFamily: type.micro.fontFamily, fontSize: 8.5, letterSpacing: 0.68, textTransform: "uppercase" },
  textNeutral: { color: color.dim },
  textStrong: { color: color.text },

  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    borderRadius: 6,
    paddingVertical: space(0.75),
    paddingHorizontal: space(1.75),
    backgroundColor: color.liveRed,
    alignSelf: "flex-start",
  },
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: color.text },
  liveText: { fontFamily: type.micro.fontFamily, fontSize: 8.5, letterSpacing: 0.68, textTransform: "uppercase", color: color.text },
});
