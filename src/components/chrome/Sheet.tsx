/**
 * DESIGN_SYSTEM.md §7 — the bottom-sheet chrome: a scrim backdrop, a curve-driven slide-up, and
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
  withTiming,
} from "react-native-reanimated";

import * as haptics from "@/lib/haptics";
import { color } from "@/lib/tokens";
import { dur, ease } from "@/theme/animations";

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
    // Timing, not spring (MOTION.md §1, revised 2026-08-02). Any underdamped spring overshoots by
    // definition — spring.pop by ~19%, spring.sheet by ~5% — and over a full screen-height travel
    // even 5% reads as a bounce. dur.base + ease.exit decelerates into rest with zero overshoot.
    // Exit is dur.fast: dismissal should feel quicker than arrival.
    open.value = visible
      ? reduced
        ? 1
        : withTiming(1, { duration: dur.base, easing: ease.exit })
      : reduced
        ? 0
        : withTiming(0, { duration: dur.fast, easing: ease.exit });
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
        drag.value = withTiming(0, { duration: dur.fast, easing: ease.exit });
        runOnJS(onDismiss)();
      } else {
        if (past && !dismissible) runOnJS(warnBlocked)();
        // Curve, not spring, for the same reason as the open animation: a snap-back that bounces
        // would contradict the slide the sheet arrived with.
        drag.value = withTiming(0, { duration: dur.base, easing: ease.exit });
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
