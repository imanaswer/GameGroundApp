/**
 * Leaderboard pieces (DESIGN_SYSTEM.md §8): Podium (top 3), LeaderRow, PinnedRankRow.
 * Count-ups + staggered rise are MOTION §8 (delivered in M14) — static values here.
 */
import { StyleSheet, Text, View } from "react-native";

import type { LeaderRow as Row } from "@/api/types";
import { Avatar, Press, TierBadge } from "@/components/ds";
import { color, layout, radius, space, type } from "@/lib/tokens";

function Delta({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const up = delta > 0;
  return <Text style={[styles.delta, up ? styles.up : styles.down]}>{up ? "▲" : "▼"}{Math.abs(delta)}</Text>;
}

const PODIUM_SIZE: Record<number, number> = { 1: 66, 2: 52, 3: 52 };

export function Podium({ top, onPress }: { top: Row[]; onPress: (id: string) => void }) {
  // Visual order: 2nd, 1st, 3rd.
  const order = [top[1], top[0], top[2]].filter(Boolean);
  return (
    <View style={styles.podium}>
      {order.map((r) => (
        <Press key={r.user.id} onPress={() => onPress(r.user.id)} style={styles.podCol}>
          <Avatar name={r.user.name} uri={r.user.avatarUrl} size={PODIUM_SIZE[r.rank] ?? 48} />
          <Text style={styles.podName} numberOfLines={1}>{r.user.name}</Text>
          <Text style={[styles.podScore, r.rank === 1 && styles.gold]}>{r.score.toLocaleString("en-IN")}</Text>
          <Text style={styles.podRank}>#{r.rank}</Text>
        </Press>
      ))}
    </View>
  );
}

export function LeaderRow({ row, onPress, highlight }: { row: Row; onPress: (id: string) => void; highlight?: boolean }) {
  return (
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
}

/** Own-rank strip pinned above the tab bar when the viewer is outside the visible list. */
export function PinnedRankRow({ row, onPress }: { row: Row; onPress: (id: string) => void }) {
  return (
    <View style={styles.pinnedWrap}>
      <LeaderRow row={row} onPress={onPress} highlight />
    </View>
  );
}

const styles = StyleSheet.create({
  podium: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: space(4), paddingVertical: space(5) },
  podCol: { alignItems: "center", gap: space(1.5), maxWidth: 100 },
  podName: { ...type.caption, color: color.text, maxWidth: 90 },
  podScore: { fontFamily: type.heading.fontFamily, fontSize: 15, color: color.text },
  gold: { color: color.gold },
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
