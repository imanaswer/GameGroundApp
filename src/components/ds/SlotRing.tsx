/**
 * DESIGN_SYSTEM.md §4 SlotRing + MOTION.md §8. 52pt SVG circle, 3.5 stroke, red progress on a
 * white .14 track; stroke-dashoffset animates to fill over 1s on mount. Center label 10px/800.
 * Home hero only in v1. Reduced-motion renders filled immediately.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

import { color, font } from "@/lib/tokens";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SlotRing({ joined, total, size = 52 }: { joined: number; total: number; size?: number }) {
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color.border2} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color.red}
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

const styles = StyleSheet.create({
  center: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  num: { fontFamily: font.sansExtra, fontSize: 15, color: color.text, fontVariant: ["tabular-nums"], lineHeight: 16 },
  unit: { fontFamily: font.sansExtra, fontSize: 7, color: color.dim, letterSpacing: 0.8 },
});
