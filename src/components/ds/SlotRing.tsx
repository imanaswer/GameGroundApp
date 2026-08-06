/**
 * DESIGN_SYSTEM.md §4 SlotRing + MOTION.md §8. 48–52pt SVG circle, 3.5 stroke, white progress on a
 * translucent-white track; stroke-dashoffset animates to fill over 1s on mount. Center label
 * 10px/800. Home hero only in v1. Reduced-motion renders filled immediately.
 *
 * **Drawn on a photograph, so every colour here is from the `inverse` family**, never the page ramp.
 * The light port had renamed these mechanically to page tokens — `border2` track, `primary` arc,
 * `text`/`dim` label — which put a near-black arc and near-black digits over a picture, and was half
 * of why the hero needed a bleaching white scrim to be readable at all. `primary` is especially
 * wrong here: since Decision 20 it is BLACK, so "progress" was drawn in the one colour guaranteed to
 * vanish into a dark photo.
 */
import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { color, font } from "@/lib/tokens";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SlotRing({ joined, total, size = 52 }: { joined: number; total: number; size?: number }) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const ratio = total > 0 ? Math.min(1, joined / total) : 0;
  const left = Math.max(0, total - joined);
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const p = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    p.value = reduced ? ratio : withTiming(ratio, { duration: 1000 });
  }, [ratio, reduced, p]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - p.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.inverseTrack} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color.inverse}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the arc at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.num}>{left}</Text>
        <Text style={styles.unit}>LEFT</Text>
      </View>
    </View>
  );
}

const sheets = themed(() => ({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  num: { fontFamily: font.sansExtra, fontSize: 14, color: color.inverse, fontVariant: ["tabular-nums"], lineHeight: 16 },
  unit: { fontFamily: font.sansExtra, fontSize: 10, color: color.inverse, opacity: 0.8, letterSpacing: 0.8 },
}));
