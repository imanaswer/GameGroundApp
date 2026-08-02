/**
 * DESIGN_SYSTEM.md §6 Camp/Workshop/EventCard. Mirrors the GameCard redesign: media header with a
 * kind badge + price pill + "spots left" pill + title overlay, then a labelled seats meter.
 * One component, section accent per kind.
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Badge, CalendarIcon, ClockIcon, FeaturedChip, Press, SlotBar } from "@/components/ds";
import { color, radius, space, type } from "@/lib/tokens";

import { CardImage, MetaRow, cardStyles } from "./parts";

export type RegistrationCardData = {
  id: string;
  kind: "camp" | "workshop" | "event";
  title: string;
  when: string;
  /** Optional time-of-day for the second meta row (matches the games card). */
  time?: string;
  price: string | null;
  imageUrl?: string | null;
  registered: number;
  capacity: number;
  featured?: boolean;
};

const KIND_LABEL: Record<RegistrationCardData["kind"], string> = {
  camp: "Camp",
  workshop: "Workshop",
  event: "Event",
};
const FILLING = 0.7;

export const RegistrationCard = memo(function RegistrationCard({
  data,
  onPress,
}: {
  data: RegistrationCardData;
  onPress: () => void;
}) {
  const capped = data.capacity > 0;
  const left = capped ? Math.max(0, data.capacity - data.registered) : 0;
  const ratio = capped ? data.registered / data.capacity : 0;
  const low = capped && left > 0 && left <= 5;

  return (
    <Press testID="registerable-card" accessibilityRole="button" accessibilityLabel={data.title} onPress={onPress} brighten style={cardStyles.card}>
      <CardImage uri={data.imageUrl} height={172}>
        <View style={styles.imageTop}>
          <View style={styles.badges}>
            <Badge label={KIND_LABEL[data.kind]} tone="red" />
            {data.featured && <FeaturedChip />}
          </View>
          <View style={[styles.pricePill, !data.price && styles.pricePillFree]}>
            <Text style={data.price ? styles.priceText : styles.freeText}>{data.price ?? "FREE"}</Text>
          </View>
        </View>
        <View style={styles.imageBottom}>
          {ratio >= FILLING && left > 0 && (
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
        {!!data.when && <MetaRow icon={<CalendarIcon size={14} color={color.dim} />} text={data.when} />}
        {!!data.time && <MetaRow icon={<ClockIcon size={14} color={color.dim} />} text={data.time} />}

        {capped ? (
          <View style={styles.spotsBlock}>
            <View style={styles.spotsHead}>
              <Text style={styles.spotsLabel}>Seats</Text>
              <Text style={[styles.spotsCount, low && styles.spotsCountLow]}>
                {data.registered}/{data.capacity}
              </Text>
            </View>
            <SlotBar joined={data.registered} total={data.capacity} hideCaption />
          </View>
        ) : (
          <Text style={styles.openText}>Registration open</Text>
        )}
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
  openText: { ...type.caption, color: color.dim, marginTop: space(0.5) },
});
