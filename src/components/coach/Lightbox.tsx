/**
 * Pinch-zoom photo lightbox (DESIGN_SYSTEM.md §7 / M8). Worklet-driven pinch + pan on the
 * UI thread (MOTION §11). Reduced-motion doesn't disable zoom — it's a control, not decoration.
 */
import { Image } from "expo-image";
import { Modal, StyleSheet, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { CloseIcon, Press } from "@/components/ds";
import { color, layout, space } from "@/lib/tokens";
import { dur } from "@/theme/animations";

export function Lightbox({
  photos,
  index,
  onClose,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        scale.value = withTiming(1, { duration: dur.fast });
        tx.value = withTiming(0, { duration: dur.fast });
        ty.value = withTiming(0, { duration: dur.fast });
        savedTx.value = 0;
        savedTy.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const next = scale.value > 1 ? 1 : 2;
      scale.value = withTiming(next, { duration: dur.fast });
      if (next === 1) {
        tx.value = withTiming(0, { duration: dur.fast });
        ty.value = withTiming(0, { duration: dur.fast });
        savedTx.value = 0;
        savedTy.value = 0;
      }
      savedScale.value = next;
    });

  const composed = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Press accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close} scaleTo={0.9} hitSlop={8}>
          <CloseIcon color={color.text} />
        </Press>
        <GestureDetector gesture={composed}>
          <Animated.View style={styles.center}>
            <Animated.View style={imgStyle}>
              <Image
                source={{ uri: photos[index] }}
                style={{ width, height: height * 0.8 }}
                contentFit="contain"
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  close: {
    position: "absolute",
    top: space(12),
    right: layout.screenX,
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
