/**
 * DESIGN_SYSTEM.md §5 ExpandCard (accordion). Card bg, radius 14, head + rotating chevron (spring),
 * body reveal. Selection haptic on toggle. Reduced-motion skips the height/chevron animation.
 */
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ChevronDownIcon, Press } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import { color, radius, space, type } from "@/lib/tokens";
import { dur, spring } from "@/theme/animations";

export function ExpandCard({
  title,
  body,
  defaultOpen = false,
}: {
  title: string;
  body: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reduced = useReducedMotion();
  const rot = useSharedValue(defaultOpen ? 1 : 0);

  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));

  const toggle = () => {
    haptics.selection();
    setOpen((o) => {
      const next = !o;
      rot.value = reduced ? (next ? 1 : 0) : withSpring(next ? 1 : 0, spring.pop);
      return next;
    });
  };

  return (
    <Animated.View
      style={styles.card}
      layout={reduced ? undefined : LinearTransition.duration(dur.base)}
    >
      <Press accessibilityRole="button" accessibilityState={{ expanded: open }} tilt={false} onPress={toggle} style={styles.head}>
        <Text style={styles.headText}>{title}</Text>
        <Animated.View style={chevronStyle}>
          <ChevronDownIcon size={15} color={color.dim} />
        </Animated.View>
      </Press>
      {open && (
        <View style={styles.body}>
          <Text style={styles.bodyText}>{body}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: color.border, borderRadius: radius.expand, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space(3.5) },
  headText: { ...type.bodyStrong, color: color.text, flex: 1 },
  body: { paddingHorizontal: space(3.5), paddingBottom: space(3.5) },
  bodyText: { ...type.body, color: color.dim, lineHeight: 20 },
});
