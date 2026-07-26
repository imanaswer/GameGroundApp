/** DESIGN_SYSTEM.md §6 CoachCard. Image + overlapping face avatar → name/sport vs stars/price. */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar, Press, Stars } from "@/components/ds";
import { color, space, type as t } from "@/lib/tokens";

import { CardImage, cardStyles } from "./parts";

export type CoachCardData = {
  id: string;
  name: string;
  sport: string;
  facilityImageUrl?: string | null;
  avatarUrl?: string | null;
  rating: number;
  price: string;
};

export const CoachCard = memo(function CoachCard({ data, onPress }: { data: CoachCardData; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" onPress={onPress} style={cardStyles.card}>
      <CardImage uri={data.facilityImageUrl} height={100} />
      <View style={styles.avatarPerch}>
        <Avatar name={data.name} uri={data.avatarUrl} size={48} />
      </View>
      <View style={[cardStyles.body, styles.body]}>
        <View style={styles.col}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {data.name}
          </Text>
          <Text style={styles.sport}>{data.sport}</Text>
        </View>
        <View style={styles.colRight}>
          <Stars value={data.rating} size={12} />
          <Text style={cardStyles.price}>{data.price}</Text>
        </View>
      </View>
    </Press>
  );
});

const styles = StyleSheet.create({
  avatarPerch: { position: "absolute", top: 100 - 24, left: space(3.5) },
  body: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: space(6) },
  col: { flex: 1, gap: space(1) },
  colRight: { alignItems: "flex-end", gap: space(1) },
  sport: { ...t.caption, color: color.dim },
});
