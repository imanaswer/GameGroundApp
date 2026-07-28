/**
 * Leaderboard pieces (DESIGN_SYSTEM.md §8): Podium (top 3), LeaderRow, PinnedRankRow.
 * MOTION §8: score count-ups + staggered rise on entry (once), gold-ringed #1 with a bobbing
 * crown, own-rank pin slides in from below. Reduced-motion renders static.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  SlideInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { LeaderRow as Row } from "@/api/types";
import { Appear, Avatar, CountUp, CrownIcon, Press, TierBadge } from "@/components/ds";
import { color, layout, radius, space, tier as tierTokens, type } from "@/lib/tokens";

function Delta({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return <Text style={[styles.delta, up ? styles.up : styles.down]}>{up ? "▲" : "▼"}{Math.abs(delta)}</Text>;
}

const PODIUM_SIZE: Record<number, number> = { 1: 66, 2: 52, 3: 52 };
const RING: Record<number, string> = { 1: tierTokens.gold.fg, 2: tierTokens.silver.fg, 3: tierTokens.bronze.fg };

/** §8 crown bob: gentle vertical float above the #1 podium avatar. */
function CrownBob() {
  const y = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduced, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: -2 - y.value * 3 }] }));
  return (
    <Animated.View style={[styles.crown, s]}>
      <CrownIcon size={18} color={color.gold} />
    </Animated.View>
  );
}

export function Podium({ top, onPress }: { top: Row[]; onPress: (id: string) => void }) {
  // Visual order: 2nd, 1st, 3rd. Stagger index runs 1st → 2nd → 3rd so the winner lands first.
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const staggerIndex: Record<number, number> = { 1: 0, 2: 1, 3: 2 };
  return (
    <View style={styles.podium}>
      {order.map((r) => {
        const size = PODIUM_SIZE[r.rank] ?? 48;
        return (
          <Appear key={r.user.id} index={staggerIndex[r.rank] ?? 0} style={styles.podCol}>
            <Press onPress={() => onPress(r.user.id)} style={styles.podPress}>
              <View>
                {r.rank === 1 && <CrownBob />}
                <View style={[styles.ring, { borderColor: RING[r.rank] ?? color.border2, borderRadius: 999 }]}>
                  <Avatar name={r.user.name} uri={r.user.avatarUrl} size={size} />
                </View>
              </View>
              <Text style={styles.podName} numberOfLines={1}>{r.user.name}</Text>
              <CountUp value={r.score} style={r.rank === 1 ? styles.podScoreGold : styles.podScore} />
              <Text style={styles.podRank}>#{r.rank}</Text>
            </Press>
          </Appear>
        );
      })}
    </View>
  );
}

export function LeaderRow({
  row,
  onPress,
  highlight,
  index,
}: {
  row: Row;
  onPress: (id: string) => void;
  highlight?: boolean;
  /** When set, the row rises in with a per-index stagger (list entry). */
  index?: number;
}) {
  const inner = (
    <Press onPress={() => onPress(row.user.id)} style={[styles.row, highlight && styles.rowSelf]}>
      <Text style={styles.rank}>{row.rank}</Text>
      <Avatar name={row.user.name} uri={row.user.avatarUrl} size={32} />
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>{row.user.name}</Text>
        {row.user.tier && <TierBadge tier={row.user.tier} />}
      </View>
      <Delta delta={row.delta} />
      <Text style={styles.score}>{row.score.toLocaleString("en-IN")}</Text>
    </Press>
  );
  return index === undefined ? inner : <Appear index={index}>{inner}</Appear>;
}

/** Own-rank strip pinned above the tab bar when the viewer is outside the visible list. */
export function PinnedRankRow({ row, onPress }: { row: Row; onPress: (id: string) => void }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View style={styles.pinnedWrap} entering={reduced ? undefined : SlideInDown.duration(320)}>
      <LeaderRow row={row} onPress={onPress} highlight />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: space(4), paddingVertical: space(5) },
  podCol: { alignItems: "center", maxWidth: 100 },
  podPress: { alignItems: "center", gap: space(1.5) },
  ring: { borderWidth: 2.5, padding: 2 },
  crown: { position: "absolute", top: -16, left: 0, right: 0, alignItems: "center", zIndex: 2 },
  podName: { ...type.caption, color: color.text, maxWidth: 90 },
  podScore: { fontFamily: type.heading.fontFamily, fontSize: 15, color: color.text },
  podScoreGold: { fontFamily: type.heading.fontFamily, fontSize: 15, color: color.gold },
  podRank: { ...type.micro, color: color.dim },

  row: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(2.5), paddingHorizontal: space(2) },
  rowSelf: { backgroundColor: color.redWash, borderRadius: radius.input },
  rank: { fontFamily: type.heading.fontFamily, fontSize: 12.5, color: color.dim, width: 28 },
  rowText: { flex: 1, flexDirection: "row", alignItems: "center", gap: space(2) },
  name: { ...type.bodyStrong, color: color.text, flexShrink: 1 },
  delta: { fontFamily: type.micro.fontFamily, fontSize: 9 },
  up: { color: color.success },
  down: { color: color.redLight },
  score: { fontFamily: type.heading.fontFamily, fontSize: 12.5, color: color.text },

  pinnedWrap: { paddingHorizontal: layout.screenX, paddingVertical: space(2), backgroundColor: color.elev, borderTopWidth: 1, borderTopColor: color.border },
});
