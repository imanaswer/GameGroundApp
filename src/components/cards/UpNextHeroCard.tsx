/**
 * DESIGN_SYSTEM.md §6 UpNextHeroCard — Home's flagship. 176pt, heroSide scrim, parallax image,
 * ambient shine sweep, UPNEXT eyebrow + pulse dot, serif title, meta, AvatarStack, ticking
 * countdown cells (§8, HH/MM/SS), SlotRing. Home only in v1.
 *
 * Parallax is opt-in via `scrollY` (Home passes its scroll position); MOTION.md §8 hero image
 * translateY ×0.18. Reduced-motion disables the loops, the parallax, and renders statically.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { AvatarStack, Press, SlotRing } from "@/components/ds";
import { color, font, gradient, radius, space, type } from "@/lib/tokens";

const HERO_H = 176;

export type UpNextData = {
  id: string;
  title: string;
  venue: string;
  /** Time-of-day label, e.g. "7:30 PM". */
  timeLabel: string;
  /** ISO 8601 start — drives the live countdown. */
  startsAt: string;
  imageUrl?: string | null;
  players: { name: string; uri?: string | null }[];
  joined: number;
  total: number;
  viewerJoined?: boolean;
};

export function UpNextHeroCard({
  data,
  onPress,
  scrollY,
}: {
  data: UpNextData;
  onPress: () => void;
  scrollY?: SharedValue<number>;
}) {
  const reduced = useReducedMotion();

  // Parallax: image drifts at 0.18× scroll (§8). No-op without scrollY or under reduced motion.
  const imageStyle = useAnimatedStyle(() => {
    const y = scrollY && !reduced ? scrollY.value * 0.18 : 0;
    return { transform: [{ translateY: y }, { scale: 1.06 }] };
  });

  return (
    <Press accessibilityRole="button" accessibilityLabel={`Up next: ${data.title}`} onPress={onPress} style={styles.card}>
      <Animated.View style={[styles.imageWrap, imageStyle]}>
        <Image
          source={data.imageUrl ? { uri: data.imageUrl } : undefined}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={data.imageUrl ?? undefined}
        />
      </Animated.View>
      <LinearGradient
        colors={gradient.heroSide.colors as unknown as [string, string]}
        locations={gradient.heroSide.locations as unknown as [number, number]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.2 }}
        style={StyleSheet.absoluteFill}
      />
      <Shine reduced={reduced} />

      <View style={styles.inner}>
        <View style={styles.topRow}>
          <View style={styles.eyebrowRow}>
            <PulseDot reduced={reduced} />
            <Text style={styles.eyebrow}>UP NEXT{data.viewerJoined ? " · YOU'RE IN" : ""}</Text>
          </View>
          <SlotRing joined={data.joined} total={data.total} size={48} />
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.bottomLeft}>
            <Text style={styles.title} numberOfLines={1}>
              {data.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {data.venue} · {data.timeLabel}
            </Text>
            {data.players.length > 0 && (
              <View style={styles.social}>
                <AvatarStack people={data.players} size={22} max={5} />
                <Text style={styles.joined}>{data.joined} joined</Text>
              </View>
            )}
          </View>
          <Countdown startsAt={data.startsAt} />
        </View>
      </View>
    </Press>
  );
}

/** §8 live dot: gentle opacity/scale pulse. */
function PulseDot({ reduced }: { reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, p]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.5, 1]), transform: [{ scale: interpolate(p.value, [0, 1], [0.85, 1.15]) }] }));
  return <Animated.View style={[styles.dot, s]} />;
}

/** §8 ambient shine: a soft light band sweeps across every ~5.5s (≤10% white). */
function Shine({ reduced }: { reduced: boolean }) {
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), withDelay(4400, withTiming(-1, { duration: 0 }))), -1, false);
  }, [reduced, x]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateX: interpolate(x.value, [-1, 1], [-220, 220]) }, { rotate: "18deg" }] }));
  if (reduced) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shine, s]}>
      <LinearGradient
        colors={["transparent", color.shineWhite, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const DAY_MS = 86_400_000;

/**
 * §8 Home countdown. Live HH/MM/SS cells only ticking inside the final day — a game days out
 * gets a calm "In N days" pill instead of false urgency (and no >99h cell overflow). At zero it
 * reads "Starting now". Ticks every second; static under reduced motion is irrelevant (it's data).
 */
function Countdown({ startsAt }: { startsAt: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(startsAt).getTime() - Date.now()));
  // Below a day the value ticks per-second; further out it barely changes, so poll each minute.
  const near = remaining < DAY_MS;
  useEffect(() => {
    const target = new Date(startsAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const iv = setInterval(tick, near ? 1000 : 60_000);
    return () => clearInterval(iv);
  }, [startsAt, near]);

  if (remaining <= 0) {
    return (
      <View style={styles.farPill} accessibilityLabel="Starting now">
        <Text style={styles.farText}>Starting now</Text>
      </View>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86_400);
  if (days >= 1) {
    const label = days === 1 ? "Tomorrow" : `In ${days} days`;
    return (
      <View style={styles.farPill} accessibilityLabel={`Starts ${days === 1 ? "tomorrow" : `in ${days} days`}`}>
        <Text style={styles.farText}>{label}</Text>
      </View>
    );
  }

  const hh = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");

  return (
    <View style={styles.countdown} accessibilityLabel={`Starts in ${hh} hours ${mm} minutes ${ss} seconds`}>
      <Cell value={hh} unit="HRS" />
      <Cell value={mm} unit="MIN" />
      <Cell value={ss} unit="SEC" />
    </View>
  );
}

function Cell({ value, unit }: { value: string; unit: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellValue}>{value}</Text>
      <Text style={styles.cellUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: HERO_H,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border2,
    overflow: "hidden",
    backgroundColor: color.imagePlaceholder,
  },
  imageWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  shine: { position: "absolute", top: -40, bottom: -40, width: 90, left: "40%" },
  inner: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, padding: space(4), justifyContent: "space-between" },

  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  dot: { width: 6, height: 6, borderRadius: 999, backgroundColor: color.redLight },
  eyebrow: { fontFamily: font.sansExtra, fontSize: 9, letterSpacing: 1.3, color: color.redLight },

  bottomRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space(3) },
  bottomLeft: { flex: 1, gap: space(1) },
  title: { ...type.title2, color: color.text },
  meta: { ...type.caption, color: color.dim },
  social: { flexDirection: "row", alignItems: "center", gap: space(2), marginTop: space(1.5) },
  joined: { ...type.caption, color: color.dim },

  countdown: { flexDirection: "row", gap: space(1.5) },
  farPill: {
    backgroundColor: color.countdownTile,
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: radius.tileSm,
    paddingVertical: space(1.5),
    paddingHorizontal: space(2.5),
    alignSelf: "flex-end",
  },
  farText: { fontFamily: font.sansExtra, fontSize: 11, color: color.text, letterSpacing: 0.3 },
  cell: {
    backgroundColor: color.countdownTile,
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: radius.tileSm,
    paddingVertical: space(1.25),
    paddingHorizontal: space(2),
    alignItems: "center",
    minWidth: 34,
  },
  cellValue: { fontFamily: font.sansExtra, fontSize: 13, color: color.text, fontVariant: ["tabular-nums"] },
  cellUnit: { fontFamily: font.sansSemi, fontSize: 7.5, color: color.dim, letterSpacing: 0.6, marginTop: 1 },
});
