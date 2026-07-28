/**
 * DESIGN_SYSTEM.md §5 HeroNav / SolidNav + MOTION.md §2. Transparent icon buttons over a detail
 * hero that morph into a solid blurred bar with a title as the hero collapses.
 *
 * Pass `scrollY` + `title` to enable the morph (interpolated around `collapseAt`; game detail
 * ~170, coach ~130). Without them it stays the plain transparent nav (back-compatible). The solid
 * bar is purely visual (pointerEvents none) — the persistent circular buttons own all taps.
 */
import { BlurView } from "expo-blur";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, Press, ShareIcon } from "@/components/ds";
import { color, layout, space, type } from "@/lib/tokens";

export function HeroNav({
  onBack,
  onShare,
  scrollY,
  title,
  collapseAt = 170,
}: {
  onBack: () => void;
  onShare?: () => void;
  scrollY?: SharedValue<number>;
  /** Title shown on the solid bar once collapsed. Enables the morph together with scrollY. */
  title?: string;
  collapseAt?: number;
}) {
  const insets = useSafeAreaInsets();

  const solidStyle = useAnimatedStyle(() => {
    const t = scrollY ? interpolate(scrollY.value, [collapseAt - 40, collapseAt], [0, 1], Extrapolation.CLAMP) : 0;
    return { opacity: t, transform: [{ translateY: (t - 1) * 8 }] };
  });

  return (
    <>
      {scrollY && title && (
        <Animated.View style={[styles.solid, { paddingTop: insets.top + space(2.5) }, solidStyle]} pointerEvents="none">
          <BlurView intensity={14} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.solidFill} />
          <Text style={styles.solidTitle} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
      )}

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
    </>
  );
}

const styles = StyleSheet.create({
  solid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: space(3),
    // Title clears the persistent circular back button (34pt) + gutter.
    paddingLeft: layout.screenX + 34 + space(3),
    paddingRight: layout.screenX,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.border,
    zIndex: 5,
    overflow: "hidden",
  },
  solidFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.navBlurBg },
  solidTitle: { ...type.heading, color: color.text },
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
