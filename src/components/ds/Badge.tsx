/** DESIGN_SYSTEM.md §4 Badge / TierBadge / LiveChip. */
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { color, space, tier as tierMap, type, type Tier } from "@/lib/tokens";

import { StarIcon } from "./icons";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

export function Badge({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "red" }) {
  const styles = useThemedStyles(sheets);
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.text, tone === "neutral" ? styles.textNeutral : styles.textStrong]}>{label}</Text>
    </View>
  );
}

export function TierBadge({ tier, suffix }: { tier: Tier; suffix?: string }) {
  const styles = useThemedStyles(sheets);
  const t = tierMap[tier];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{suffix ? `${tier} ${suffix}` : tier}</Text>
    </View>
  );
}

/** Server-flagged highlight — gold pill overlaid on card images (mirrors the web "Featured" label). */
export function FeaturedChip({ label = "Featured" }: { label?: string }) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  return (
    <View style={styles.featured}>
      <StarIcon size={9} color={color.goldDeep} />
      <Text style={styles.featuredText}>{label}</Text>
    </View>
  );
}

/** FILLING FAST / live states: red bg, white text, pulsing 4px dot. */
export function LiveChip({ label }: { label: string }) {
  const styles = useThemedStyles(sheets);
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

const sheets = themed(() => ({
  badge: { borderRadius: 6, paddingVertical: space(0.75), paddingHorizontal: space(1.75), alignSelf: "flex-start" },
  neutral: { backgroundColor: color.card },
  success: { backgroundColor: color.successSurface },
  red: { backgroundColor: color.errorSurface },
  text: { fontFamily: type.micro.fontFamily, fontSize: 10, letterSpacing: 0.68, textTransform: "uppercase" },
  textNeutral: { color: color.dim },
  textStrong: { color: color.text },

  live: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1.25),
    borderRadius: 6,
    paddingVertical: space(0.75),
    paddingHorizontal: space(1.75),
    backgroundColor: color.live,
    alignSelf: "flex-start",
  },
  // White on the filled live chip. `color.text` is near-black since the light port and would sit
  // at ~2:1 on the Error-500 fill — legible as a shape, unreadable as text.
  dot: { width: 4, height: 4, borderRadius: 999, backgroundColor: color.inverse },
  liveText: { fontFamily: type.micro.fontFamily, fontSize: 10, letterSpacing: 0.68, textTransform: "uppercase", color: color.inverse },

  featured: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(1),
    borderRadius: 6,
    paddingVertical: space(0.75),
    paddingHorizontal: space(1.75),
    backgroundColor: color.goldLight,
    alignSelf: "flex-start",
  },
  featuredText: { fontFamily: type.micro.fontFamily, fontSize: 10, letterSpacing: 0.68, textTransform: "uppercase", color: color.text },
}));
