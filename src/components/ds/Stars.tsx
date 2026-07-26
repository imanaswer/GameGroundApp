/** DESIGN_SYSTEM.md §4 Stars. Gold, fractional fill via SVG clip. Static. */
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { color, space } from "@/lib/tokens";

/** Lucide star path on a 24-box. */
const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

function Star({ fill, size }: { fill: number; size: number }) {
  const clamped = Math.max(0, Math.min(1, fill));
  const gradId = `star-${Math.round(clamped * 100)}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset={clamped} stopColor={color.gold} />
          <Stop offset={clamped} stopColor={color.track} />
        </LinearGradient>
      </Defs>
      <Rect width={24} height={24} fill="transparent" />
      <Path d={STAR} fill={`url(#${gradId})`} />
    </Svg>
  );
}

export function Stars({ value, size = 10 }: { value: number; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} fill={value - i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: "row", gap: space(0.5) } });
