/**
 * MOTION.md §5 tier-up moment (product AC 6.6.1 — the retention hook, never cut).
 * Full-screen scrim, TierBadge spring.pop with shine, confetti double-burst, serif headline,
 * tap-to-dismiss, Heavy haptic. Fires once per tier (stored last-seen). Reduced-motion → static.
 *
 * Mounted once as <TierUpProvider>; screens with the user's tier call celebrate(tier) and this
 * only takes over when the tier has actually increased vs the stored last-seen value.
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
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Confetti, TrophyIcon } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import * as storage from "@/lib/storage";
import { tierUpDecision } from "@/lib/tierUp";
import { color, space, tier as tierMap, type, type Tier } from "@/lib/tokens";
import { spring } from "@/theme/animations";

type TierUpMeta = { caption?: string };
type Shown = { tier: Tier; caption?: string };
type TierUpContextValue = {
  /** Real tier-up: only takes over when the tier actually increased vs the stored last-seen. */
  celebrate: (tier: Tier | null, meta?: TierUpMeta) => void;
  /** Force the celebration for the given tier regardless of history (demo / "simulate tier-up"). */
  simulate: (tier: Tier | null, meta?: TierUpMeta) => void;
};
const TierUpContext = createContext<TierUpContextValue | null>(null);

export function TierUpProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<Shown | null>(null);

  const celebrate = useCallback((tier: Tier | null, meta?: TierUpMeta) => {
    if (!tier) return;
    storage.get("gg.lastSeenTier").then((last) => {
      const decision = tierUpDecision(tier, last);
      if (decision === "skip") return;
      storage.set("gg.lastSeenTier", tier); // record + celebrate both persist the new tier
      if (decision === "celebrate") setShown({ tier, caption: meta?.caption });
    });
  }, []);

  // Demo trigger — always shows, never persists last-seen (so it doesn't suppress a real tier-up).
  const simulate = useCallback((tier: Tier | null, meta?: TierUpMeta) => {
    if (!tier) return;
    setShown({ tier, caption: meta?.caption });
  }, []);

  const value = useMemo(() => ({ celebrate, simulate }), [celebrate, simulate]);

  return (
    <TierUpContext.Provider value={value}>
      {children}
      {shown && (
        <TierUpOverlay tier={shown.tier} caption={shown.caption} onDismiss={() => setShown(null)} />
      )}
    </TierUpContext.Provider>
  );
}

function TierUpOverlay({ tier, caption, onDismiss }: { tier: Tier; caption?: string; onDismiss: () => void }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(reduced ? 1 : 0.6);

  useEffect(() => {
    haptics.tierUp();
    if (!reduced) scale.value = withSpring(1, spring.pop);
  }, [reduced, scale]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View entering={reduced ? undefined : FadeIn} style={styles.scrim}>
      <Pressable style={styles.fill} onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss">
        {!reduced && (
          <>
            <Confetti />
            <Confetti />
          </>
        )}
        <View style={styles.center}>
          <Animated.View style={badgeStyle}>
            <View style={[styles.badgeWrap, { backgroundColor: tierMap[tier].fg }]}>
              <TrophyIcon size={44} color={color.bg} />
            </View>
          </Animated.View>
          <Animated.Text entering={reduced ? undefined : FadeInDown.delay(150)} style={styles.headline}>
            You just hit {tier[0].toUpperCase() + tier.slice(1)}
          </Animated.Text>
          <Animated.Text entering={reduced ? undefined : FadeInDown.delay(250)} style={styles.sub}>
            {caption ?? "Keep playing to climb higher."}
          </Animated.Text>
          <Animated.Text entering={reduced ? undefined : FadeInDown.delay(400)} style={styles.hint}>
            Tap anywhere to continue
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function useTierUp(): TierUpContextValue {
  const ctx = useContext(TierUpContext);
  if (!ctx) throw new Error("useTierUp must be used inside <TierUpProvider>");
  return ctx;
}

const styles = StyleSheet.create({
  // Solid app-black, not a translucent scrim — the celebration owns the whole screen (no bleed-through).
  scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.bg, zIndex: 200 },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space(3), paddingHorizontal: space(6) },
  badgeWrap: { width: 104, height: 104, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  headline: { ...type.title1, fontSize: 30, color: color.text, textAlign: "center", marginTop: space(4) },
  sub: { ...type.body, color: color.dim, textAlign: "center" },
  hint: { ...type.caption, color: color.dim2, marginTop: space(4) },
});
