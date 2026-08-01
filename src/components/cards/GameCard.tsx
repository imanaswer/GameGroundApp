/**
 * DESIGN_SYSTEM.md §6 GameCard — the workhorse. Props shaped from kit GG_DATA;
 * M5 maps real API GameSummary → this view model. `compact` is the 210×88 rail variant
 * used by Home rails (title / meta / price / joined-count).
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AvatarStack, Badge, ClockIcon, LiveChip, MapPinIcon, Press, SlotBar, TierBadge } from "@/components/ds";
import { color, radius, space, type, type Tier } from "@/lib/tokens";

import { CardImage, MetaRow, cardStyles } from "./parts";

export type GameCardData = {
  id: string;
  title: string;
  /** Sport label for the image badge (e.g. "Football"). */
  sport?: string;
  /** Optional skill-level badge (e.g. "All Levels"). */
  level?: string | null;
  venue: string;
  when: string;
  /** null → FREE label (§6). */
  price: string | null;
  imageUrl?: string | null;
  fillingFast?: boolean;
  players: { name: string; uri?: string | null }[];
  organizerTier?: Tier;
  joined: number;
  total: number;
};

export const GameCard = memo(function GameCard({
  data,
  onPress,
  compact = false,
}: {
  data: GameCardData;
  onPress: () => void;
  compact?: boolean;
}) {
  if (compact) return <CompactGameCard data={data} onPress={onPress} />;

  const left = Math.max(0, data.total - data.joined);
  const low = left > 0 && left <= 2;

  return (
    <Press accessibilityRole="button" accessibilityLabel={data.title} onPress={onPress} brighten style={cardStyles.card}>
      <CardImage uri={data.imageUrl} height={172}>
        <View style={styles.imageTop}>
          <View style={styles.badges}>
            {!!data.sport && <Badge label={data.sport} tone="red" />}
            {!!data.level && <Badge label={data.level} />}
          </View>
          <View style={[styles.pricePill, !data.price && styles.pricePillFree]}>
            <Text style={data.price ? styles.priceText : styles.freeText}>{data.price ?? "FREE"}</Text>
          </View>
        </View>
        <View style={styles.imageBottom}>
          {data.fillingFast && left > 0 && (
            <View style={styles.spotsLeftPill}>
              <Text style={styles.spotsLeftText}>
                {left} spot{left === 1 ? "" : "s"} left
              </Text>
            </View>
          )}
          <Text style={styles.overlayTitle} numberOfLines={2}>
            {data.title}
          </Text>
        </View>
      </CardImage>
      <View style={cardStyles.body}>
        <MetaRow icon={<MapPinIcon size={14} color={color.dim} />} text={data.venue} />
        <MetaRow icon={<ClockIcon size={14} color={color.dim} />} text={data.when} />

        <View style={styles.spotsBlock}>
          <View style={styles.spotsHead}>
            <Text style={styles.spotsLabel}>Spots</Text>
            <Text style={[styles.spotsCount, low && styles.spotsCountLow]}>
              {data.joined}/{data.total}
            </Text>
          </View>
          <SlotBar joined={data.joined} total={data.total} />
        </View>

        <View style={styles.footer}>
          <AvatarStack people={data.players} />
          {data.organizerTier && <TierBadge tier={data.organizerTier} suffix="host" />}
        </View>
      </View>
    </Press>
  );
});

const CompactGameCard = memo(function CompactGameCard({ data, onPress }: { data: GameCardData; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={data.title} onPress={onPress} brighten style={styles.compact}>
      <CardImage uri={data.imageUrl} height={88}>
        {data.fillingFast ? <LiveChip label="Filling fast" /> : <View />}
      </CardImage>
      <View style={styles.compactBody}>
        <Text style={cardStyles.title} numberOfLines={1}>
          {data.title}
        </Text>
        <MetaRow icon={<MapPinIcon size={13} color={color.dim} />} text={`${data.venue} · ${data.when}`} />
        <View style={styles.compactFoot}>
          <Text style={data.price ? cardStyles.price : cardStyles.free}>{data.price ?? "FREE"}</Text>
          <Text style={styles.joined}>
            {data.joined}/{data.total}
          </Text>
        </View>
      </View>
    </Press>
  );
});

const styles = StyleSheet.create({
  // ── image overlay ──
  imageTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space(2) },
  badges: { flexDirection: "row", gap: space(1.5), flexShrink: 1, flexWrap: "wrap" },
  pricePill: {
    borderRadius: radius.chip,
    paddingVertical: space(1),
    paddingHorizontal: space(2.5),
    backgroundColor: color.scrim,
    borderWidth: 1,
    borderColor: color.border2,
  },
  pricePillFree: { backgroundColor: color.successSurface, borderColor: color.successSurface },
  priceText: { fontFamily: type.heading.fontFamily, fontSize: 12, color: color.text },
  freeText: { fontFamily: type.heading.fontFamily, fontSize: 12, color: color.success },

  imageBottom: { gap: space(1.5), alignItems: "flex-start" },
  spotsLeftPill: {
    borderRadius: radius.chip,
    paddingVertical: space(0.75),
    paddingHorizontal: space(2),
    backgroundColor: color.goldLight,
  },
  spotsLeftText: { fontFamily: type.micro.fontFamily, fontSize: 9.5, letterSpacing: 0.4, color: color.bg },
  overlayTitle: { ...type.heading, color: color.text },

  // ── body ──
  spotsBlock: { gap: space(1.5), marginTop: space(0.5) },
  spotsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  spotsLabel: { ...type.caption, color: color.dim },
  spotsCount: { ...type.caption, color: color.dim, fontVariant: ["tabular-nums"] },
  spotsCountLow: { color: color.goldLight },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space(0.5) },

  compact: {
    width: 210,
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  compactBody: { padding: space(3), gap: space(2) },
  compactFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space(1) },
  joined: { ...type.caption, color: color.dim, fontVariant: ["tabular-nums"] },
});
