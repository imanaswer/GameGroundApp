/**
 * In-flow top nav for plain (non-hero) screens (DESIGN_SYSTEM.md §5). Unlike HeroNav — which is
 * absolutely positioned to float over a detail hero image — PageNav occupies real layout height, so
 * a page title rendered below it never collides with the back button. Optional `right` slot holds a
 * trailing action (e.g. Settings).
 */
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BackIcon, Press } from "@/components/ds";
import { color, space, type } from "@/lib/tokens";

export function PageNav({ onBack, title, right }: { onBack: () => void; title?: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Press
          accessibilityRole="button"
          accessibilityLabel="Back"
          scaleTo={0.9}
          hitSlop={8}
          onPress={onBack}
          style={styles.btn}
        >
          <BackIcon color={color.text} />
        </Press>
        {!!title && <Text style={styles.title}>{title}</Text>}
      </View>
      {right ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space(2),
    paddingTop: space(2),
    paddingBottom: space(2),
  },
  left: { flexDirection: "row", alignItems: "center", gap: space(2.5) },
  title: { ...type.title2, color: color.text },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: color.elev,
    alignItems: "center",
    justifyContent: "center",
  },
});
