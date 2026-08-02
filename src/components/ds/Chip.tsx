/** DESIGN_SYSTEM.md §4 Chip / ChipRow. Selection haptic; active list animates in the consumer. */
import { ScrollView, StyleSheet, Text } from "react-native";

import * as haptics from "@/lib/haptics";
import { color, layout, radius, space, type } from "@/lib/tokens";

import { Press } from "./Press";

export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  size = "md",
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** `sm` — a tighter, secondary-filter chip (e.g. the leaderboard time window). */
  size?: "md" | "sm";
}) {
  const sm = size === "sm";
  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      scaleTo={0.9}
      onPress={() => {
        haptics.selection();
        onPress?.();
      }}
      style={[styles.chip, sm && styles.chipSm, active ? styles.active : styles.rest, disabled && styles.disabled]}
    >
      <Text style={[styles.label, sm && styles.labelSm, active ? styles.activeLabel : styles.restLabel]}>
        {label}
      </Text>
    </Press>
  );
}

/** Horizontal scroll row, no scrollbar, 8 gap, screen-padding inset (§3). */
export function ChipRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => (
        <Chip
          key={item.key}
          label={item.label}
          active={item.key === value}
          onPress={() => onChange(item.key)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: layout.chipGap, paddingHorizontal: layout.screenX },
  chip: {
    borderRadius: radius.chip,
    paddingVertical: space(2),
    paddingHorizontal: space(4),
    borderWidth: 1,
  },
  chipSm: { paddingVertical: space(1.25), paddingHorizontal: space(2.5) },
  rest: { backgroundColor: color.card, borderColor: color.border },
  // Tinted "selected" state (matches the design-kit chip): red-wash fill, red border, bright-red text.
  active: { backgroundColor: color.redSurface, borderColor: color.redFocus },
  disabled: { opacity: 0.5 },
  label: { fontFamily: type.bodyStrong.fontFamily, fontSize: 12.5 },
  labelSm: { fontSize: 11 },
  restLabel: { color: color.dim },
  activeLabel: { color: color.redLight },
});
