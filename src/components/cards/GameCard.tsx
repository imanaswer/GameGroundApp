/**
 * DESIGN_SYSTEM.md §6 GameCard — the workhorse. Props shaped from kit GG_DATA;
 * M5 maps real API GameSummary → this view model. `compact` is the 210×88 rail variant
 * used by Home rails (title / meta / price / joined-count).
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AvatarStack, LiveChip, MapPinIcon, Press, SlotBar, TierBadge } from "@/components/ds";
import { color, radius, space, type, type Tier } from "@/lib/tokens";

import { CardImage, MetaRow, cardStyles } from "./parts";

export type GameCardData = {
  id: string;
  title: string;
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

  return (
    <Press accessibilityRole="button" accessibilityLabel={data.title} onPress={onPress} brighten style={cardStyles.card}>
      <CardImage uri={data.imageUrl} height={118}>
        {data.fillingFast ? <LiveChip label="Filling fast" /> : <View />}
      </CardImage>
      <View style={cardStyles.body}>
        <View style={styles.titleRow}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {data.title}
          </Text>
          <Text style={data.price ? cardStyles.price : cardStyles.free}>{data.price ?? "FREE"}</Text>
        </View>
        <MetaRow icon={<MapPinIcon size={14} color={color.dim} />} text={`${data.venue} · ${data.when}`} />
        <View style={styles.socialRow}>
          <AvatarStack people={data.players} />
          {data.organizerTier && <TierBadge tier={data.organizerTier} />}
        </View>
        <SlotBar joined={data.joined} total={data.total} />
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
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
  socialRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space(1) },

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
