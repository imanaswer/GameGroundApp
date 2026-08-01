/**
 * DESIGN_SYSTEM.md §6 SetupCard — a dismissible-once informational nudge (infoSurface bg, neutral
 * icon tile, bold lead + body, chevron). The whole card taps through to `onPress`; the trailing ×
 * calls `onDismiss` so a user who has made their choice can clear the nudge for good.
 *
 * The icon tile is intentionally neutral (white on the blue info surface) rather than a brand
 * accent — one color note per card, so the informational surface reads as informational.
 */
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { ChevronRightIcon, CloseIcon, Press } from "@/components/ds";
import { color, radius, space, type } from "@/lib/tokens";

export function SetupCard({
  icon,
  title,
  body,
  onPress,
  onDismiss,
  style,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  onPress: () => void;
  /** When provided, renders a trailing × that clears the nudge (dismissible-once). */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, style]}>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        accessibilityHint="Opens your profile to complete setup"
        onPress={onPress}
        tilt={false}
        style={styles.main}
      >
        <View style={styles.iconTile}>{icon}</View>
        <View style={styles.text}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        <ChevronRightIcon color={color.dim2} />
      </Press>
      {onDismiss && (
        <Press
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onDismiss}
          scaleTo={0.9}
          hitSlop={8}
          style={styles.dismiss}
        >
          <CloseIcon size={15} color={color.dim} />
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.infoSurface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    paddingRight: space(2),
  },
  main: { flex: 1, flexDirection: "row", alignItems: "center", gap: space(3), padding: space(3.5) },
  iconTile: { width: 34, height: 34, borderRadius: 999, backgroundColor: color.border2, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: space(0.5) },
  title: { ...type.heading, color: color.text },
  body: { ...type.caption, color: color.dim },
  dismiss: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 999 },
});
