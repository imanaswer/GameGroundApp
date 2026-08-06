/**
 * DESIGN_SYSTEM.md §6 CoachCard. Image + overlapping face avatar → name/sport vs stars/price.
 * `compact` is the 150pt centered rail variant used by Home (facility image, −22 overlap avatar,
 * name, sport, stars) — pairs with GameCard's compact so sibling rails share one card grammar.
 */
import { memo } from "react";
import { Text, View } from "react-native";

import { Avatar, Badge, Press, Stars } from "@/components/ds";
import { color, radius, space, type as t } from "@/lib/tokens";

import { CardImage, cardStyles } from "./parts";
import { themed, useThemedStyles } from "@/theme/runtime";

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
  const styles = useThemedStyles(sheets);
  // Through the hook, not read off the import — see the note in GameCard's CompactGameCard.
  const cards = useThemedStyles(cardStyles);
  if (compact) return <CompactCoachCard data={data} onPress={onPress} />;

  // Split "₹600/session" so the amount is red and the unit stays dim; "On request" has no unit.
  const hasUnit = data.price.includes("/session");
  const amount = hasUnit ? data.price.replace("/session", "") : data.price;

  return (
    <Press testID="coach-card" accessibilityRole="button" accessibilityLabel={data.name} onPress={onPress} brighten style={cards.card}>
      <CardImage uri={data.facilityImageUrl} height={100} />
      <View style={styles.avatarPerch}>
        <Avatar name={data.name} uri={data.avatarUrl} size={48} />
      </View>
      <View style={[cards.body, styles.body]}>
        <View style={styles.col}>
          <Text style={cards.title} numberOfLines={1}>
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
  const styles = useThemedStyles(sheets);
  const rated = data.rating > 0 || data.reviewCount > 0;
  return (
    <Press testID="coach-card" accessibilityRole="button" accessibilityLabel={`${data.name}, ${data.sport} coach`} onPress={onPress} brighten style={styles.compact}>
      <CardImage uri={data.facilityImageUrl} height={84} />
      <View style={styles.compactAvatar}>
        <Avatar name={data.name} uri={data.avatarUrl} size={44} />
      </View>
      <View style={styles.compactBody}>
        <Text style={styles.compactName} numberOfLines={1}>
          {data.name}
        </Text>
        {/* Badge carries `alignSelf: "flex-start"` (DS §4 — chips hug their content in the
            left-aligned columns they were designed for), and alignSelf beats this column's
            `alignItems: "center"`. So the pill sat against the card's left edge while the name and
            the rating line above and below it centred. Wrapping it hands the flex-start a box the
            width of the pill itself, which the column then centres. */}
        <View style={styles.compactSport}>
          <Badge label={data.sport} tone="red" />
        </View>
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

const sheets = themed(() => ({
  // Bordered, matching cardStyles.card. See parts.tsx.
  compact: { width: 150, borderRadius: radius.card, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  // Avatar overlaps the image by 22px, centered (DS §6). 84 image − 22 = 62.
  compactAvatar: { position: "absolute", top: 84 - 22, left: 0, right: 0, alignItems: "center" },
  compactBody: { paddingTop: space(6), paddingBottom: space(3.5), paddingHorizontal: space(3), gap: space(1.5), alignItems: "center" },
  /**
   * The stretch + 2pt inset fixes a clipped leading glyph ("AHAMED ROSHAN" rendered with its A
   * shaved off). A centred, single-line, ellipsised Text is the one shape that reliably crops:
   * the name fills the box exactly, Android's ellipsis measurement lands a hair wide of the layout
   * width, and `compact`'s `overflow: "hidden"` takes the difference off the leading edge — while
   * the trailing "…" makes it read as deliberate truncation rather than a bug.
   *
   * `alignSelf: "stretch"` gives the Text a definite box to ellipsise into instead of one measured
   * from its own content, and the 2pt inset leaves room for glyph side bearings and the −0.14
   * tracking to round into. Both are cheap; the failure is invisible until a long name appears.
   */
  compactName: {
    ...t.heading,
    color: color.text,
    textAlign: "center",
    alignSelf: "stretch",
    paddingHorizontal: 2,
  },
  compactSport: { alignItems: "center" },
  compactRating: { flexDirection: "row", alignItems: "center", gap: space(1) },

  avatarPerch: { position: "absolute", top: 100 - 24, left: space(3.5) },
  body: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: space(6), gap: space(2) },
  col: { flex: 1, gap: space(1) },
  colRight: { alignItems: "flex-end", gap: space(1.5) },
  sportRow: { flexDirection: "row", marginTop: space(0.5) },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  // Only the stars are yellow; the number reads as plain text with a dim count in parens.
  rating: { fontFamily: t.heading.fontFamily, fontSize: 14, color: color.text },
  ratingCount: { fontFamily: t.body.fontFamily, fontSize: 12, color: color.dim },
  ratingNew: { ...t.caption, color: color.dim },
  price: { fontFamily: t.bodyStrong.fontFamily, fontSize: 14, color: color.primarySoft },
  priceUnit: { fontFamily: t.caption.fontFamily, fontSize: 12, color: color.dim },
  priceMuted: { ...t.caption, color: color.dim },
}));
