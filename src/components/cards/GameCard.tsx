/**
 * DESIGN_SYSTEM.md §6 GameCard — the workhorse. Props shaped from kit GG_DATA;
 * M5 maps real API GameSummary → this view model.
 */
import { StyleSheet, Text, View } from "react-native";

import { AvatarStack, LiveChip, MapPinIcon, Press, SlotBar, TierBadge } from "@/components/ds";
import { color, space, type Tier } from "@/lib/tokens";

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

export function GameCard({ data, onPress }: { data: GameCardData; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" onPress={onPress} style={cardStyles.card}>
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
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
  socialRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: space(1) },
});
