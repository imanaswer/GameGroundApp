/**
 * DESIGN_SYSTEM.md §5 / MOTION.md §2·§8 — detail hero. Image parallaxes at ~0.32× scroll and
 * settles scale 1.12→1 over dur.slow on entry, under the heroScrim gradient. Overscan hides the
 * parallax edge. Reduced-motion renders static (no parallax, no settle).
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, gradient, layout, space } from "@/lib/tokens";
import { dur, ease } from "@/theme/animations";

const OVERSCAN = 60;

export function ParallaxHero({
  imageUrl,
  height,
  scrollY,
  children,
  topRight,
}: {
  imageUrl?: string | null;
  height: number;
  scrollY?: SharedValue<number>;
  /** Overlay content (e.g. a title block) pinned inside the hero. */
  children?: React.ReactNode;
  /** Optional chip pinned top-right, below the nav (e.g. a DateBadge). Scrolls with the hero. */
  topRight?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const enter = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) enter.value = withTiming(1, { duration: dur.slow, easing: ease.exit });
  }, [reduced, enter]);

  const imageStyle = useAnimatedStyle(() => {
    const parallax = scrollY && !reduced ? scrollY.value * 0.32 : 0;
    const scale = 1.12 - enter.value * 0.12; // 1.12 → 1 on entry
    return { transform: [{ translateY: parallax }, { scale }] };
  });

  return (
    <View style={[styles.hero, { height }]}>
      <Animated.View style={[styles.imageWrap, { height: height + OVERSCAN * 2 }, imageStyle]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={imageUrl} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]} />
        )}
      </Animated.View>
      <LinearGradient
        colors={gradient.heroScrim.colors as unknown as [string, string, string]}
        locations={gradient.heroScrim.locations as unknown as [number, number, number]}
        style={StyleSheet.absoluteFill}
      />
      {topRight && (
        <View style={[styles.topRight, { top: insets.top + space(11) }]} pointerEvents="box-none">
          {topRight}
        </View>
      )}
      {children && <View style={styles.overlay}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: color.imagePlaceholder, overflow: "hidden" },
  imageWrap: { position: "absolute", top: -OVERSCAN, left: 0, right: 0 },
  fallback: { backgroundColor: color.card },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0 },
  topRight: { position: "absolute", right: layout.screenX },
});
