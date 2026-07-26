/**
 * Profile pieces (DESIGN_SYSTEM.md §8): PlayerHeroCard, RankProgress, StatStrip, WeekStrip.
 * Count-ups + ambient pulse are MOTION §8 (M14) — static values here. WeekStrip is
 * attendance intensity only (Decision 6 — not an achievements surface).
 */
import { StyleSheet, Text, View } from "react-native";

import type { ProfileStats, RankProgress as Progress, UserProfile } from "@/api/types";
import { Avatar, CountUp, TierBadge } from "@/components/ds";
import { color, radius, space, type } from "@/lib/tokens";

export function PlayerHeroCard({ profile, isSelf }: { profile: UserProfile; isSelf?: boolean }) {
  return (
    <View style={styles.hero}>
      <Avatar name={profile.name} uri={profile.avatarUrl} size={64} isSelf={isSelf} />
      <Text style={styles.name}>{profile.name}</Text>
      <Text style={styles.handle}>
        @{profile.username}
        {profile.city ? ` · ${profile.city}` : ""}
      </Text>
      {profile.tier && <TierBadge tier={profile.tier} />}
      {profile.progress && <RankProgress progress={profile.progress} />}
    </View>
  );
}

export function RankProgress({ progress }: { progress: Progress }) {
  const ratio =
    progress.nextTierAt && progress.nextTierAt > 0
      ? Math.min(1, progress.points / progress.nextTierAt)
      : 1;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.progressMetaRow}>
        <CountUp value={progress.points} suffix=" pts" style={styles.progressMeta} />
        <Text style={styles.progressMeta}>
          {progress.nextTierAt ? ` · next tier at ${progress.nextTierAt}` : " · top tier"}
        </Text>
      </View>
    </View>
  );
}

export function StatStrip({ stats }: { stats: ProfileStats }) {
  const cells = [
    { label: "Games", value: stats.games, suffix: "" },
    { label: "Attendance", value: stats.attendance, suffix: "%" },
    { label: "Reputation", value: stats.reputation, suffix: "" },
  ];
  return (
    <View style={styles.strip}>
      {cells.map((c, i) => (
        <View key={c.label} style={[styles.cell, i > 0 && styles.cellDivider]}>
          <CountUp value={c.value} suffix={c.suffix} style={styles.cellValue} />
          <Text style={styles.cellLabel}>{c.label}</Text>
        </View>
      ))}
      <View style={[styles.cell, styles.cellDivider]}>
        <Text style={styles.cellValue}>{stats.rank ? `#${stats.rank}` : "—"}</Text>
        <Text style={styles.cellLabel}>Rank</Text>
      </View>
    </View>
  );
}

/** 10 attendance-intensity bars (Decision 6 — attendance data only). */
export function WeekStrip({ data }: { data: number[] }) {
  if (data.length === 0) return null;
  return (
    <View style={styles.week}>
      {data.slice(0, 10).map((v, i) => (
        <View key={i} style={[styles.weekBar, { height: 8 + v * 32, opacity: 0.4 + v * 0.6 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: space(2), paddingVertical: space(4), backgroundColor: color.card, borderRadius: radius.profileHero, borderWidth: 1, borderColor: color.border, paddingHorizontal: space(4) },
  name: { ...type.title2, color: color.text },
  handle: { ...type.body, color: color.dim },
  progressWrap: { alignSelf: "stretch", marginTop: space(2), gap: space(1.5) },
  track: { height: 7, borderRadius: 999, backgroundColor: color.track, overflow: "hidden" },
  fill: { height: 7, borderRadius: 999, backgroundColor: color.red },
  progressMetaRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  progressMeta: { ...type.caption, color: color.dim, textAlign: "center" },

  strip: { flexDirection: "row", backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, paddingVertical: space(3) },
  cell: { flex: 1, alignItems: "center", gap: space(1) },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: color.border },
  cellValue: { fontFamily: type.heading.fontFamily, fontSize: 16, color: color.text },
  cellLabel: { ...type.micro, color: color.dim, textTransform: "uppercase" },

  week: { flexDirection: "row", alignItems: "flex-end", gap: space(1.5), height: 44 },
  weekBar: { flex: 1, borderRadius: 3, backgroundColor: color.red },
});
