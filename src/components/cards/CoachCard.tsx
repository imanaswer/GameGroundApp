/**
 * DESIGN_SYSTEM.md §6 CoachCard. Image + overlapping face avatar → name/sport vs stars/price.
 * `compact` is the 150pt centered rail variant used by Home (facility image, −22 overlap avatar,
 * name, sport, stars) — pairs with GameCard's compact so sibling rails share one card grammar.
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Avatar, Badge, Press, Stars } from "@/components/ds";
import { color, radius, space, type as t } from "@/lib/tokens";

import { CardImage, cardStyles } from "./parts";

export type CoachCardData = {
  id: string;
  name: string;
  sport: string;
  facilityImageUrl?: string | null;
  avatarUrl?: string | null;
  rating: number;
  reviewCount: number;
  price: string;
};

export const CoachCard = memo(function CoachCard({
  data,
  onPress,
  compact = false,
}: {
  data: CoachCardData;
  onPress: () => void;
  compact?: boolean;
}) {
  if (compact) return <CompactCoachCard data={data} onPress={onPress} />;

  // Split "₹600/session" so the amount is red and the unit stays dim; "On request" has no unit.
  const hasUnit = data.price.includes("/session");
  const amount = hasUnit ? data.price.replace("/session", "") : data.price;

  return (
    <Press accessibilityRole="button" accessibilityLabel={data.name} onPress={onPress} brighten style={cardStyles.card}>
      <CardImage uri={data.facilityImageUrl} height={100} />
      <View style={styles.avatarPerch}>
        <Avatar name={data.name} uri={data.avatarUrl} size={48} />
      </View>
      <View style={[cardStyles.body, styles.body]}>
        <View style={styles.col}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {data.name}
          </Text>
          <View style={styles.sportRow}>
            <Badge label={data.sport} tone="red" />
          </View>
        </View>
        <View style={styles.colRight}>
          <View style={styles.ratingRow}>
            {data.rating > 0 || data.reviewCount > 0 ? (
              <>
                <Stars value={data.rating} size={12} />
                <Text style={styles.rating}>
                  {data.rating.toFixed(1)}
                  {data.reviewCount > 0 && <Text style={styles.ratingCount}> ({data.reviewCount})</Text>}
                </Text>
              </>
            ) : (
              <Text style={styles.ratingNew}>New</Text>
            )}
          </View>
          <Text style={hasUnit ? styles.price : styles.priceMuted} numberOfLines={1}>
            {amount}
            {hasUnit && <Text style={styles.priceUnit}>/session</Text>}
          </Text>
        </View>
      </View>
    </Press>
  );
});

/** 150pt centered rail card (DS §6). No price — name / sport / stars only, to stay legible small. */
const CompactCoachCard = memo(function CompactCoachCard({ data, onPress }: { data: CoachCardData; onPress: () => void }) {
  const rated = data.rating > 0 || data.reviewCount > 0;
  return (
    <Press accessibilityRole="button" accessibilityLabel={`${data.name}, ${data.sport} coach`} onPress={onPress} brighten style={styles.compact}>
      <CardImage uri={data.facilityImageUrl} height={84} />
      <View style={styles.compactAvatar}>
        <Avatar name={data.name} uri={data.avatarUrl} size={44} />
      </View>
      <View style={styles.compactBody}>
        <Text style={styles.compactName} numberOfLines={1}>
          {data.name}
        </Text>
        <Badge label={data.sport} tone="red" />
        <View style={styles.compactRating}>
          {rated ? (
            <>
              <Stars value={data.rating} size={11} />
              <Text style={styles.rating}>{data.rating.toFixed(1)}</Text>
            </>
          ) : (
            <Text style={styles.ratingNew}>New coach</Text>
          )}
        </View>
      </View>
    </Press>
  );
});

const styles = StyleSheet.create({
  compact: { width: 150, backgroundColor: color.card, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  // Avatar overlaps the image by 22px, centered (DS §6). 84 image − 22 = 62.
  compactAvatar: { position: "absolute", top: 84 - 22, left: 0, right: 0, alignItems: "center" },
  compactBody: { paddingTop: space(6), paddingBottom: space(3.5), paddingHorizontal: space(3), gap: space(1.5), alignItems: "center" },
  compactName: { ...t.heading, color: color.text, textAlign: "center" },
  compactRating: { flexDirection: "row", alignItems: "center", gap: space(1) },

  avatarPerch: { position: "absolute", top: 100 - 24, left: space(3.5) },
  body: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: space(6), gap: space(2) },
  col: { flex: 1, gap: space(1) },
  colRight: { alignItems: "flex-end", gap: space(1.5) },
  sportRow: { flexDirection: "row", marginTop: space(0.5) },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  // Only the stars are yellow; the number reads as plain text with a dim count in parens.
  rating: { fontFamily: t.heading.fontFamily, fontSize: 13, color: color.text },
  ratingCount: { fontFamily: t.body.fontFamily, fontSize: 12, color: color.dim },
  ratingNew: { ...t.caption, color: color.dim },
  price: { fontFamily: t.bodyStrong.fontFamily, fontSize: 13, color: color.redLight },
  priceUnit: { fontFamily: t.caption.fontFamily, fontSize: 11, color: color.dim },
  priceMuted: { ...t.caption, color: color.dim },
});
