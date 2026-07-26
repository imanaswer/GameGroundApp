/**
 * MOTION.md §5 confetti burst. 26 pieces, 5-color set, randomized trajectory + rotation,
 * self-removing over 0.7–1.2s. One-shot on mount. Reduced-motion renders nothing (celebrations
 * become static per §9). Worklet-driven; each piece animates on the UI thread.
 */
import { useEffect, useId, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { confetti as palette } from "@/lib/tokens";

const COUNT = 26;

/** Deterministic PRNG (mulberry32) — keeps render pure (no Math.random) while varying per mount. */
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

type Piece = {
  color: string;
  x: number; // horizontal drift
  y: number; // fall distance
  rotate: number; // total rotation deg
  delay: number;
  duration: number;
  size: number;
};

function Confetto({ piece }: { piece: Piece }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: piece.duration, easing: Easing.out(Easing.quad) });
  }, [t, piece.duration]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.8 ? 1 : 1 - (t.value - 0.8) / 0.2,
    transform: [
      { translateX: t.value * piece.x },
      { translateY: t.value * piece.y },
      { rotate: `${t.value * piece.rotate}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        { width: piece.size, height: piece.size, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const id = useId();

  const pieces = useMemo<Piece[]>(() => {
    const rnd = makeRng(hash(id));
    return Array.from({ length: COUNT }, () => ({
      color: palette[Math.floor(rnd() * palette.length)],
      x: (rnd() - 0.5) * width * 0.9,
      y: 200 + rnd() * 320,
      rotate: (rnd() - 0.5) * 720,
      delay: rnd() * 120,
      duration: 700 + rnd() * 500,
      size: 6 + rnd() * 6,
    }));
  }, [width, id]);

  if (reduced) return null;

  return (
    <View pointerEvents="none" style={styles.host}>
      {pieces.map((p, i) => (
        <Confetto key={i} piece={p} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "flex-start" },
  piece: { position: "absolute", top: "35%", borderRadius: 2 },
});
