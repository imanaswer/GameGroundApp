/**
 * DESIGN_SYSTEM.md §5 HeroNav. Transparent icon buttons over a detail hero.
 * The scroll-driven morph to SolidNav lands with the detail screens (M5+).
 */
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, Press, ShareIcon } from "@/components/ds";
import { color, layout, space } from "@/lib/tokens";

export function HeroNav({ onBack, onShare }: { onBack: () => void; onShare?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.row, { top: insets.top + space(1) }]} pointerEvents="box-none">
      <Press accessibilityRole="button" accessibilityLabel="Back" scaleTo={0.9} onPress={onBack} style={styles.btn}>
        <BackIcon color={color.text} />
      </Press>
      {onShare && (
        <Press accessibilityRole="button" accessibilityLabel="Share" scaleTo={0.9} onPress={onShare} style={styles.btn}>
          <ShareIcon color={color.text} />
        </Press>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "absolute",
    left: layout.screenX,
    right: layout.screenX,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 10,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: color.elev,
    alignItems: "center",
    justifyContent: "center",
  },
});
