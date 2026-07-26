import { Easing } from "react-native-reanimated";

/**
 * MOTION.md §1 — the ONLY timing/spring values in the app. Nothing inline, ever.
 */
export const dur = {
  instant: 100,
  fast: 150,
  base: 280,
  slow: 420,
  moment: 900,
} as const;

export const spring = {
  press: { damping: 18, stiffness: 320 },
  pop: { damping: 14, stiffness: 220 },
  sheet: { damping: 22, stiffness: 260 },
  layout: { damping: 20, stiffness: 200 },
} as const;

export const ease = {
  exit: Easing.out(Easing.cubic),
} as const;
