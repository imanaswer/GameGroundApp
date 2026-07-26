/**
 * DESIGN_SYSTEM.md §5 Toast. Top-anchored, elev bg, icon tile + title/body + draining 2px
 * progress bar over its 2.4s life. Springs in from −100 (MOTION §5). One at a time; re-trigger
 * resets. Tappable — foreground notifications route through it (M12).
 *
 * Animation is driven from state via effects (the codebase pattern) so shared-value writes
 * never sit inside a useCallback (react-hooks/immutability).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { BellIcon, Press } from "@/components/ds";
import { color, radius, shadow, space, type } from "@/lib/tokens";
import { dur, spring } from "@/theme/animations";

const LIFE_MS = 2400;
const OFFSCREEN = -120;

export type ToastInput = { title: string; body?: string; onPress?: () => void };

type ToastContextValue = { show: (t: ToastInput) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [toast, setToast] = useState<ToastInput | null>(null);
  const [visible, setVisible] = useState(false);
  // Bumped on every show() so re-triggers restart the animation even while one is visible.
  const [nonce, setNonce] = useState(0);

  const translateY = useSharedValue(OFFSCREEN);
  const progress = useSharedValue(1);

  const show = useCallback((t: ToastInput) => {
    setToast(t);
    setVisible(true);
    setNonce((n) => n + 1);
  }, []);

  // Single effect owns all shared-value writes (the codebase pattern — writes never in a callback,
  // never split across effects). One ternary write per value keeps react-hooks/immutability happy.
  useEffect(() => {
    translateY.value = visible
      ? reduced
        ? 0
        : withSpring(0, spring.pop)
      : reduced
        ? OFFSCREEN
        : withTiming(OFFSCREEN, { duration: dur.fast });
    progress.value = visible
      ? withSequence(withTiming(1, { duration: 0 }), withTiming(0, { duration: LIFE_MS }))
      : 0;
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), LIFE_MS);
    return () => clearTimeout(timer);
  }, [visible, nonce, translateY, progress, reduced]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View style={[styles.wrap, { top: insets.top + space(2) }, cardStyle]} pointerEvents="box-none">
          <Press
            accessibilityRole="button"
            onPress={() => {
              setVisible(false);
              toast.onPress?.();
            }}
            style={styles.card}
          >
            <View style={styles.iconTile}>
              <BellIcon size={16} color={color.red} />
            </View>
            <View style={styles.text}>
              <Text style={styles.title} numberOfLines={1}>{toast.title}</Text>
              {!!toast.body && <Text style={styles.body} numberOfLines={2}>{toast.body}</Text>}
            </View>
            <View style={styles.track}>
              <Animated.View style={[styles.bar, barStyle]} />
            </View>
          </Press>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space(4), right: space(4), zIndex: 100 },
  card: {
    backgroundColor: color.elev,
    borderRadius: radius.toast,
    borderWidth: 1,
    borderColor: color.border,
    padding: space(3),
    flexDirection: "row",
    alignItems: "center",
    gap: space(3),
    overflow: "hidden",
    ...shadow.sheet,
  },
  iconTile: { width: 32, height: 32, borderRadius: 9, backgroundColor: color.redSurface, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: space(0.5) },
  title: { fontFamily: type.heading.fontFamily, fontSize: 12.5, color: color.text },
  body: { ...type.caption, color: color.dim },
  track: { position: "absolute", left: 0, right: 0, bottom: 0, height: 2, backgroundColor: color.border },
  bar: { height: 2, backgroundColor: color.red },
});
