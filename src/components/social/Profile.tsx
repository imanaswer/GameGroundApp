/**
 * Profile pieces (DESIGN_SYSTEM.md §8): PlayerHeroCard, RankProgress, StatStrip, WeekStrip.
 * Count-ups + ambient pulse are MOTION §8 (M14) — static values here. WeekStrip is
 * attendance intensity only (Decision 6 — not an achievements surface).
 */
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

import type { ActivityItem, ProfileGame, ProfileStats, RankProgress as Progress, UserProfile } from "@/api/types";
import {
  Avatar,
  CardIcon,
  CheckIcon,
  ChevronRightIcon,
  CountUp,
  InfoIcon,
  Press,
  StarIcon,
  TierBadge,
  TrophyIcon,
  UserIcon,
} from "@/components/ds";
import { formatAgo, formatWhen } from "@/lib/format";
import { sportImage } from "@/lib/sportImages";
import { nextTier } from "@/lib/tierLadder";
import { color, radius, space, tier as tierMap, type } from "@/lib/tokens";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function PlayerHeroCard({ profile, isSelf }: { profile: UserProfile; isSelf?: boolean }) {
  return (
    <View style={styles.hero}>
      {/* Sport-derived cover that fades into the card — gives the identity surface depth (DS §8). */}
      <View style={styles.cover}>
        <Image source={{ uri: sportImage(profile.sports?.[0]) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        <LinearGradient colors={["transparent", color.card]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        {isSelf && (
          <View style={styles.editChip}>
            <Text style={styles.editChipText}>Edit</Text>
          </View>
        )}
      </View>
      <View style={styles.heroBody}>
        <View style={styles.heroRow}>
          {/* Card-colored ring lifts the avatar off the cover image behind it. */}
          <View style={styles.avatarRing}>
            <Avatar name={profile.name} uri={profile.avatarUrl} size={64} isSelf={isSelf} />
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{profile.username}
              {profile.city ? ` · ${profile.city}` : ""}
            </Text>
            {profile.tier && (
              <View style={styles.tierRow}>
                <TierBadge tier={profile.tier} />
              </View>
            )}
          </View>
        </View>
        {profile.progress && <RankProgress progress={profile.progress} />}
      </View>
    </View>
  );
}

export function RankProgress({ progress }: { progress: Progress }) {
  const ratio =
    progress.nextTierAt && progress.nextTierAt > 0
      ? Math.min(1, progress.points / progress.nextTierAt)
      : 1;
  const next = nextTier(progress.tier);
  return (
    <View style={styles.progressWrap}>
      <View style={styles.track}>
        <LinearGradient
          colors={[tierMap[progress.tier].fg, color.gold]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${Math.max(4, ratio * 100)}%` }]}
        />
      </View>
      <View style={styles.progressMetaRow}>
        <CountUp value={progress.points} suffix=" pts" style={styles.progressMeta} />
        <Text style={styles.progressMeta}>{next ? `${cap(next.tier)} at ${next.at}` : "Top tier"}</Text>
      </View>
    </View>
  );
}

export function StatStrip({ stats }: { stats: ProfileStats }) {
  return (
    <View style={styles.strip}>
      <Cell label="Games" value={<CountUp value={stats.games} style={styles.cellValue} />} />
      <Cell label="Organized" value={<CountUp value={stats.organized} style={styles.cellValue} />} divider />
      <Cell label="Attendance" value={<CountUp value={stats.attendance} suffix="%" style={styles.cellValue} />} divider />
      <Cell
        label="Reliability"
        value={
          <Text style={styles.cellValue}>
            {stats.reliability.toFixed(1)}
            <Text style={styles.cellUnit}>/5</Text>
          </Text>
        }
        divider
      />
    </View>
  );
}

function Cell({ label, value, divider }: { label: string; value: React.ReactNode; divider?: boolean }) {
  return (
    <View style={[styles.cell, divider && styles.cellDivider]}>
      {value}
      <Text style={styles.cellLabel}>{label}</Text>
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

/** Games the viewer has joined that are still ahead — soonest first (DESIGN_SYSTEM.md §8). */
export function UpcomingGames({ games, onOpen }: { games: ProfileGame[]; onOpen: (id: string) => void }) {
  if (games.length === 0) return null;
  return (
    <View style={styles.feed}>
      <Text style={styles.feedLabel}>Upcoming</Text>
      <View style={styles.feedCard}>
        {games.map((g, i) => (
          <Press
            key={g.id}
            accessibilityRole="button"
            accessibilityLabel={`${g.title}, ${formatWhen(g.startsAt)}`}
            onPress={() => onOpen(g.id)}
            style={[styles.feedRow, i > 0 && styles.feedDivider]}
          >
            <Image source={{ uri: sportImage(g.sport) }} style={styles.thumb} contentFit="cover" transition={150} />
            <View style={styles.feedText}>
              <Text style={styles.feedTitle} numberOfLines={1}>
                {g.title}
              </Text>
              <Text style={styles.feedMeta} numberOfLines={1}>
                {[formatWhen(g.startsAt), g.venue].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <ChevronRightIcon size={16} color={color.dim2} />
          </Press>
        ))}
      </View>
    </View>
  );
}

type ActivityVisual = { Icon: React.ComponentType<{ size?: number; color?: string }>; tint: string; bg: string };

/** Activity kind → badge glyph + tint (tokens only). The server's `kind` drives the icon. */
const ACTIVITY_VISUALS: Record<string, ActivityVisual> = {
  joined: { Icon: UserIcon, tint: color.success, bg: color.successSurface },
  attended: { Icon: CheckIcon, tint: color.success, bg: color.successSurface },
  played: { Icon: CheckIcon, tint: color.success, bg: color.successSurface },
  created: { Icon: StarIcon, tint: color.gold, bg: tierMap.gold.bg },
  organized: { Icon: StarIcon, tint: color.gold, bg: tierMap.gold.bg },
  booked: { Icon: CardIcon, tint: color.redLight, bg: color.redSurface },
  tier_up: { Icon: TrophyIcon, tint: color.gold, bg: tierMap.gold.bg },
};
const ACTIVITY_FALLBACK: ActivityVisual = { Icon: InfoIcon, tint: color.dim, bg: color.track };

/** Recent reputation-earning events. The "+N REP" chip renders only when the server sends a delta. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.feed}>
      <Text style={styles.feedLabel}>Recent Activity</Text>
      <View style={styles.feedCard}>
        {items.map((it, i) => {
          const v = ACTIVITY_VISUALS[it.kind] ?? ACTIVITY_FALLBACK;
          return (
            <View key={it.id} style={[styles.feedRow, i > 0 && styles.feedDivider]}>
              <View style={[styles.badge, { backgroundColor: v.bg }]}>
                <v.Icon size={15} color={v.tint} />
              </View>
              <View style={styles.feedText}>
                <Text style={styles.feedTitle} numberOfLines={2}>
                  {it.title}
                </Text>
                <Text style={styles.feedMeta}>
                  {[formatAgo(it.at), it.points ? `+${it.points} REP` : null].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: color.card,
    borderRadius: radius.profileHero,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  cover: { height: 88, backgroundColor: color.imagePlaceholder },
  editChip: {
    position: "absolute",
    top: space(2.5),
    right: space(2.5),
    backgroundColor: color.scrim,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: color.border2,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
  },
  editChipText: { fontFamily: type.bodyStrong.fontFamily, fontSize: 11, color: color.text },
  // Pulled up so the avatar overlaps the cover; card-colored ring separates it from the image.
  heroBody: { padding: space(4), marginTop: -space(7), gap: space(4) },
  heroRow: { flexDirection: "row", alignItems: "flex-end", gap: space(3.5) },
  avatarRing: { borderRadius: 999, borderWidth: 3, borderColor: color.card },
  heroInfo: { flex: 1, gap: space(1), paddingBottom: space(1) },
  name: { ...type.title2, color: color.text },
  handle: { ...type.body, color: color.dim },
  tierRow: { flexDirection: "row", marginTop: space(1) },

  progressWrap: { gap: space(1.5) },
  track: { height: 7, borderRadius: 999, backgroundColor: color.track, overflow: "hidden" },
  fill: { height: 7, borderRadius: 999 },
  progressMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressMeta: { ...type.caption, color: color.dim },

  strip: { flexDirection: "row", backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, paddingVertical: space(3) },
  cell: { flex: 1, alignItems: "center", gap: space(1) },
  cellDivider: { borderLeftWidth: 1, borderLeftColor: color.border },
  cellValue: { fontFamily: type.heading.fontFamily, fontSize: 18, color: color.text },
  cellUnit: { fontFamily: type.caption.fontFamily, fontSize: 11, color: color.dim },
  cellLabel: { ...type.micro, color: color.dim, textTransform: "uppercase" },

  week: { flexDirection: "row", alignItems: "flex-end", gap: space(1.5), height: 44 },
  weekBar: { flex: 1, borderRadius: 3, backgroundColor: color.red },

  feed: { gap: space(2.5) },
  feedLabel: { ...type.label, color: color.dim },
  feedCard: {
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space(3.5),
  },
  feedRow: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(3) },
  feedDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  feedText: { flex: 1, gap: space(0.75) },
  feedTitle: { ...type.bodyStrong, color: color.text },
  feedMeta: { ...type.caption, color: color.dim },
  thumb: { width: 44, height: 44, borderRadius: radius.tile, backgroundColor: color.imagePlaceholder },
  badge: { width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
});
