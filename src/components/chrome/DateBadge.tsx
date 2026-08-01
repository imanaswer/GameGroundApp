/**
 * Calendar-style date chip for detail heroes (DESIGN_SYSTEM.md §5) — a light tile with the red month
 * over a bold day, e.g. "JUL / 05". Shows a registerable's / game's exact start date over the hero.
 */
import { StyleSheet, Text, View } from "react-native";

import { dateBadge } from "@/lib/format";
import { color, font, radius, space, type } from "@/lib/tokens";

export function DateBadge({ iso }: { iso: string }) {
  const parts = dateBadge(iso);
  if (!parts) return null;
  return (
    <View style={styles.badge} accessibilityLabel={`${parts.month} ${parts.day}`}>
      <Text style={styles.month}>{parts.month}</Text>
      <Text style={styles.day}>{parts.day}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: color.text,
    borderRadius: radius.tile,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    alignItems: "center",
    minWidth: 46,
  },
  month: { ...type.label, color: color.red },
  day: { fontFamily: font.sansExtra, fontSize: 20, lineHeight: 22, color: color.bg },
});
