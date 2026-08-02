/**
 * Shared chrome for the auth screens (Login / Signup / reset).
 *
 * DECISION 20 — ported to the source's auth pattern (its Login 02 / Sign up screens): a plain
 * white ground, the brand mark small and black at the top-left, then one heavy left-aligned
 * headline over the form. The red radial glow and the serif-italic accent word are gone; the
 * source has neither a brand accent nor a serif, and a coloured glow on white reads as a
 * rendering artefact rather than atmosphere.
 *
 * `accent` is retained as a prop and simply continues the headline, so callers did not have to
 * change. It no longer carries its own styling.
 */
import type { ReactNode } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/components/chrome/Screen";
import { AppleGlyph, BackIcon, GoogleGlyph } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import { color, google, radius, space, type } from "@/lib/tokens";

const MARK = require("@/assets/images/logo-mark.png");

type ShellProps = {
  title: string;
  /** Trailing word of the heading. Kept as a separate prop for callers; no longer styled. */
  accent: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

/** Scrolls, keyboard-avoids, and lays out back → mark → heading → children. */
export function AuthShell({ title, accent, subtitle, onBack, children }: ShellProps) {
  const insets = useSafeAreaInsets();
  return (
    // Full-bleed with the scroll content inset by hand, so the back button clears the notch.
    <Screen padded={false} fullBleed>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + space(2), paddingBottom: space(7) + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Press
            accessibilityRole="button"
            accessibilityLabel="Back"
            scaleTo={0.9}
            hitSlop={8}
            onPress={onBack}
            style={styles.back}
          >
            <BackIcon size={22} color={color.text} />
          </Press>

          <Image source={MARK} style={styles.mark} resizeMode="contain" tintColor={color.primary} />
          <Text style={styles.heading}>
            {title} <Text style={styles.accent}>{accent}</Text>
          </Text>
          <Text style={styles.sub}>{subtitle}</Text>

          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** White Google button with the 4-color mark. Bordered since the page ground is now white. */
export function GoogleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.social, styles.google, disabled && styles.socialDisabled]}>
      <GoogleGlyph size={18} />
      <Text style={[styles.socialLabel, styles.googleLabel]}>{label}</Text>
    </Press>
  );
}

/** Black Apple button — kept for iOS alongside Google. */
export function AppleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.social, styles.apple, disabled && styles.socialDisabled]}>
      <AppleGlyph size={18} color={color.inverse} />
      <Text style={[styles.socialLabel, styles.appleLabel]}>{label}</Text>
    </Press>
  );
}

/** Hairline "or" divider between the social buttons and the form. */
export function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.rule} />
      <Text style={styles.or}>or</Text>
      <View style={styles.rule} />
    </View>
  );
}

/** Bottom "prompt → action" line (e.g. "Already have an account? Log in"). */
export function SwitchLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.switch}>
      <Text style={styles.switchPrompt}>{prompt} </Text>
      <Press accessibilityRole="link" onPress={onPress} tilt={false}>
        <Text style={styles.switchAction}>{action}</Text>
      </Press>
    </View>
  );
}

const SOCIAL_H = 50;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: space(2), paddingBottom: space(7) },

  /**
   * Bare chevron, no chrome. The filled 40pt circle was a dark-theme device: on #050505 a button
   * needed a fill and a border to be findable at all. On white it is a heavy grey token competing
   * with the headline, and the source's frame has no such control — its back affordance lives in
   * browser chrome, so the screen itself opens on the mark.
   */
  back: { width: 32, height: 32, marginLeft: -space(1), alignItems: "flex-start", justifyContent: "center" },
  /**
   * Small, wide and BLACK — a mark, not a logo tile.
   *
   * The asset is the red mark (#F65F57) and this was the one place it rendered untinted; Header
   * has always tinted it. After the light port that left a red logo on a white page in a system
   * whose whole point is that it has no brand accent — the only coloured element on the screen,
   * and the first thing the eye lands on.
   *
   * Size: at 46² it read as a third heavyweight block above the headline. The source's mark is
   * roughly a third of that area and sits clear of the type, which is what lets the headline lead.
   */
  mark: { width: 44, height: 33, marginTop: space(7), marginBottom: space(5) },
  heading: { ...type.authTitle, color: color.text },
  accent: { color: color.text },
  /**
   * Caption weight, not body. The source has no subtitle at all — just a small meta line
   * ("United States · Change"). A full body-size paragraph under the headline halves its impact,
   * which is most of why this did not read as the reference.
   */
  sub: { ...type.caption, color: color.dim, marginTop: space(2), marginBottom: space(7) },

  social: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(2.5),
    height: SOCIAL_H,
    // Pill, matching Button since the port — the source has no rounded-rectangle buttons, so a
    // radius-16 social button beside a pill CTA read as two different systems.
    borderRadius: radius.chip,
    marginBottom: space(3),
  },
  // A white button on a white page needs a border to exist at all; on the old dark ground the
  // surface alone was the separation.
  google: { backgroundColor: google.surface, borderWidth: 1, borderColor: color.border },
  // Black fill, per Apple's own light-mode guidance and the source's filled-action language.
  // Was a near-black card fill on a dark ground; on white that became grey-on-white mush.
  apple: { backgroundColor: color.primary },
  socialDisabled: { opacity: 0.5 },
  socialLabel: { ...type.bodyStrong, color: color.text },
  appleLabel: { color: color.inverse },
  googleLabel: { color: google.onSurface },

  divider: { flexDirection: "row", alignItems: "center", gap: space(3.5), marginVertical: space(5) },
  rule: { flex: 1, height: 1, backgroundColor: color.border2 },
  or: { ...type.caption, color: color.dim2 },

  switch: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: space(6) },
  switchPrompt: { ...type.body, color: color.dim },
  switchAction: { ...type.bodyStrong, color: color.text, textDecorationLine: "underline" },
});
