/** DESIGN_SYSTEM.md §4 Chip / ChipRow. Selection haptic; active list animates in the consumer. */
import { ScrollView, StyleSheet, Text } from "react-native";

import * as haptics from "@/lib/haptics";
import { color, layout, radius, shadow, space, type } from "@/lib/tokens";

import { Press } from "./Press";

export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}) {
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
      style={[styles.chip, active ? styles.active : styles.rest, active && shadow.ctaRed, disabled && styles.disabled]}
    >
      <Text style={[styles.label, active ? styles.activeLabel : styles.restLabel]}>{label}</Text>
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
    paddingVertical: space(1.75),
    paddingHorizontal: space(3.5),
    borderWidth: 1,
  },
  rest: { backgroundColor: color.card, borderColor: color.border },
  active: { backgroundColor: color.red, borderColor: color.red },
  disabled: { opacity: 0.5 },
  label: { fontFamily: type.bodyStrong.fontFamily, fontSize: 12 },
  restLabel: { color: color.dim },
  activeLabel: { color: color.text },
});
