/**
 * DESIGN_SYSTEM.md §6 Camp/Workshop/EventCard. GameCard anatomy + a registration
 * SlotBar ("x% registered") + FILLING FAST >70%. One component, section accent per kind.
 */
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CalendarIcon, LiveChip, Press, SlotBar } from "@/components/ds";
import { color, space } from "@/lib/tokens";

import { CardImage, MetaRow, cardStyles } from "./parts";

export type RegistrationCardData = {
  id: string;
  kind: "camp" | "workshop" | "event";
  title: string;
  when: string;
  price: string | null;
  imageUrl?: string | null;
  registered: number;
  capacity: number;
};

const FILLING = 0.7;

export const RegistrationCard = memo(function RegistrationCard({
  data,
  onPress,
}: {
  data: RegistrationCardData;
  onPress: () => void;
}) {
  const ratio = data.capacity > 0 ? data.registered / data.capacity : 0;
  return (
    <Press accessibilityRole="button" onPress={onPress} style={cardStyles.card}>
      <CardImage uri={data.imageUrl} height={118}>
        {ratio >= FILLING ? <LiveChip label="Filling fast" /> : <View />}
      </CardImage>
      <View style={cardStyles.body}>
        <View style={styles.titleRow}>
          <Text style={cardStyles.title} numberOfLines={1}>
            {data.title}
          </Text>
          <Text style={data.price ? cardStyles.price : cardStyles.free}>{data.price ?? "FREE"}</Text>
        </View>
        <MetaRow icon={<CalendarIcon size={14} color={color.dim} />} text={data.when} />
        <SlotBar joined={data.registered} total={data.capacity} />
      </View>
    </Press>
  );
});

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(2) },
});
