/**
 * Calendar-style date chip for detail heroes (DESIGN_SYSTEM.md §5) — a light tile with the red month
 * over a bold day, e.g. "JUL / 05". Shows a registerable's / game's exact start date over the hero.
 */
import { Text, View } from "react-native";

import { dateBadge } from "@/lib/format";
import { color, font, radius, space, type } from "@/lib/tokens";
import { themed, useThemedStyles } from "@/theme/runtime";

export function DateBadge({ iso }: { iso: string }) {
  const styles = useThemedStyles(sheets);
  const parts = dateBadge(iso);
  if (!parts) return null;
  return (
    <View style={styles.badge} accessibilityLabel={`${parts.month} ${parts.day}`}>
      <Text style={styles.month}>{parts.month}</Text>
      <Text style={styles.day}>{parts.day}</Text>
    </View>
  );
}

const sheets = themed(() => ({
  badge: {
    backgroundColor: color.text,
    borderRadius: radius.tile,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    alignItems: "center",
    minWidth: 46,
  },
  // The badge fill is `color.text`, so both lines are the PAGE colour — that is the one value
  // that inverts with it for free. `inverse` is fixed white and vanished on dark's near-white
  // fill; `primary` was black-on-black before that.
  month: { ...type.label, color: color.bg, opacity: 0.7 },
  day: { fontFamily: font.sansExtra, fontSize: 20, lineHeight: 22, color: color.bg },
}));
