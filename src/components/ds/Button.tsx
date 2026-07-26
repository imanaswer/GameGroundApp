/** DESIGN_SYSTEM.md §4 Button. Variants: primary / secondary / ghost / mini. */
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import * as haptics from "@/lib/haptics";
import { color, shadow, space, type } from "@/lib/tokens";

import { Press } from "./Press";

type Variant = "primary" | "secondary" | "ghost" | "mini";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  style,
}: Props) {
  const isPrimary = variant === "primary";
  const off = disabled || loading;
  return (
    <Press
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      disabled={off}
      onPress={() => {
        haptics.buttonPress();
        onPress();
      }}
      style={[
        styles.base,
        styles[variant],
        isPrimary && shadow.ctaRed,
        off && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator color={isPrimary ? color.text : color.dim} />
        ) : (
          <>
            {icon}
            <Text style={[styles.label, styles[`${variant}Label`]]}>{title}</Text>
          </>
        )}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", minHeight: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: space(2) },
  disabled: { opacity: 0.5 },

  primary: { backgroundColor: color.red, borderRadius: 16, paddingVertical: space(3.5), paddingHorizontal: space(5) },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: 16,
    paddingVertical: space(3.5),
    paddingHorizontal: space(5),
  },
  ghost: { paddingVertical: space(2), paddingHorizontal: space(2) },
  mini: { backgroundColor: color.red, borderRadius: 11, minHeight: 34, paddingVertical: space(2.25), paddingHorizontal: space(3.75) },

  label: { ...type.heading, color: color.text },
  primaryLabel: { color: color.text },
  secondaryLabel: { color: color.text },
  ghostLabel: { color: color.dim },
  miniLabel: { fontFamily: type.heading.fontFamily, fontSize: 11.5, color: color.text },
});
