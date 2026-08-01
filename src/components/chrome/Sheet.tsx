/**
 * DESIGN_SYSTEM.md §7 — the bottom-sheet chrome: a scrim backdrop, a spring slide-up, and
 * drag-to-dismiss. A `dismissible={false}` guard blocks the backdrop tap and the drag-release
 * (warning haptic instead) so payment verification can't be swiped away mid-flight.
 *
 * This owns only the overlay behaviour — scrim, slide, gesture, guard. The content it wraps
 * supplies its own surface (bg, top radius, grab handle); the gesture covers that handle so it
 * becomes a real drag affordance. CheckoutSheet is the first consumer.
 *
 * Two shared values, one writer each (the React-Compiler lint forbids mutating one value in both
 * an effect and a gesture): `open` is driven by the `visible` prop in an effect; `drag` is driven
 * by the pan gesture. They compose in the animated transform. The overlay stays mounted and goes
 * `pointerEvents="none"` when hidden so a closed sheet never blocks the screen.
 *
 * Note: drag thresholds/velocity are tuned by reason here; confirm feel on a device.
 */
import { useEffect } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/lib/haptics";
import { color } from "@/lib/tokens";
import { spring } from "@/theme/animations";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DRAG_DISMISS = 140; // px dragged past which a release closes the sheet
const FLING_DISMISS = 800; // downward velocity that closes regardless of distance

export function Sheet({
  visible,
  onDismiss,
  dismissible = true,
  children,
}: {
  visible: boolean;
  onDismiss: () => void;
  /** When false (payment verifying), the backdrop/drag can't close it — warning haptic instead (§7). */
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const { height: screenH } = useWindowDimensions();
  const open = useSharedValue(0); // 0 = closed, 1 = open — the ONLY writer is the effect below
  const drag = useSharedValue(0); // downward drag offset — the ONLY writer is the pan gesture

  useEffect(() => {
    open.value = visible
      ? reduced
        ? 1
        : withSpring(1, spring.pop)
      : reduced
        ? 0
        : withTiming(0, { duration: 220 });
  }, [visible, reduced, open]);

  const warnBlocked = () => haptics.warning();
  const requestClose = () => (dismissible ? onDismiss() : warnBlocked());

  const pan = Gesture.Pan()
    .activeOffsetY(12) // only claim the gesture on a real downward drag — taps/buttons pass through
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      drag.value = Math.max(0, e.translationY); // follow down from the resting (open) position
    })
    .onEnd((e) => {
      const past = e.translationY > DRAG_DISMISS || e.velocityY > FLING_DISMISS;
      if (past && dismissible) {
        drag.value = withTiming(0, { duration: 200 });
        runOnJS(onDismiss)();
      } else {
        if (past && !dismissible) runOnJS(warnBlocked)();
        drag.value = withSpring(0, spring.pop);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(open.value, [0, 1], [screenH, 0]) + drag.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: open.value }));

  return (
    <View style={styles.overlay} pointerEvents={visible ? "auto" : "none"}>
      <AnimatedPressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={requestClose}
        style={[styles.scrim, scrimStyle]}
      />
      <GestureDetector gesture={pan}>
        <Animated.View
          // Only trap the screen reader while open — the sheet stays mounted (off-screen) when closed.
          accessibilityViewIsModal={visible}
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
          style={[styles.sheet, sheetStyle]}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.scrim },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
