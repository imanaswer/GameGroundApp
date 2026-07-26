/**
 * DESIGN_SYSTEM.md §4 SlotBar. 5px track, red fill; >75% → gold gradient + "hot".
 * Width animates on mount (MOTION.md §8). Paired slotlab caption row.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { color, space, type } from "@/lib/tokens";

const HOT = 0.75;

export function SlotBar({ joined, total }: { joined: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, joined / total) : 0;
  const hot = ratio >= HOT;
  const left = Math.max(0, total - joined);

  const width = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    width.value = reduced ? ratio : withTiming(ratio, { duration: 800 });
  }, [ratio, width, reduced]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]}>
          {hot ? (
            <LinearGradient
              colors={[color.gold, color.goldLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.grow}
            />
          ) : (
            <View style={[styles.grow, styles.red]} />
          )}
        </Animated.View>
      </View>
      <Text style={styles.lab}>
        {joined}/{total} joined · {left} left
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 999, backgroundColor: color.track, overflow: "hidden" },
  fill: { height: 5, borderRadius: 999, overflow: "hidden" },
  grow: { flex: 1 },
  red: { backgroundColor: color.red },
  lab: { ...type.caption, color: color.dim, marginTop: space(1.5) },
});
