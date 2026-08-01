/**
 * Shared chrome for the auth screens (Login / Signup), ported from the GameGround
 * design-system mock (ui_kits/mobile-app/parts/screens-auth.jsx): a top red radial glow,
 * the brand mark, a heavy heading with a serif-italic accent word, white Google + dark Apple
 * social buttons, an "or" divider, and the bottom switch link. Screens supply the form.
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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen } from "@/components/chrome/Screen";
import { AppleGlyph, BackIcon, GoogleGlyph } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import { color, font, google, space, type } from "@/lib/tokens";

const MARK = require("@/assets/images/logo-mark.png");

/** Top-anchored red radial glow (mock: radial-gradient ellipse at 50% 0%). */
function AuthGlow() {
  const { width } = useWindowDimensions();
  const height = 300;
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="authGlow" cx="50%" cy="0%" rx="72%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={color.red} stopOpacity={0.18} />
            <Stop offset="1" stopColor={color.red} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#authGlow)" />
      </Svg>
    </View>
  );
}

type ShellProps = {
  title: string;
  /** Serif-italic accent word rendered in red at the end of the heading. */
  accent: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

/** Scrolls, keyboard-avoids, and lays out glow → back → mark → heading → children. */
export function AuthShell({ title, accent, subtitle, onBack, children }: ShellProps) {
  const insets = useSafeAreaInsets();
  return (
    <Screen padded={false}>
      <AuthGlow />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: space(7) + insets.bottom }]}
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

          <Image source={MARK} style={styles.mark} resizeMode="contain" />
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

/** White Google button with the 4-color mark (mock's primary social action). */
export function GoogleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.social, styles.google, disabled && styles.socialDisabled]}>
      <GoogleGlyph size={18} />
      <Text style={[styles.socialLabel, styles.googleLabel]}>{label}</Text>
    </Press>
  );
}

/** Dark Apple button — kept for iOS alongside Google (glyph inherits text color). */
export function AppleButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.social, styles.apple, disabled && styles.socialDisabled]}>
      <AppleGlyph size={18} color={color.text} />
      <Text style={styles.socialLabel}>{label}</Text>
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
  glow: { position: "absolute", top: 0, left: 0, right: 0 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: space(2), paddingBottom: space(7) },

  back: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border2,
  },
  mark: { width: 46, height: 46, marginTop: space(6), marginBottom: space(4) },
  heading: { ...type.authTitle, color: color.text },
  accent: { fontFamily: font.serif, fontStyle: "italic", color: color.redLight },
  sub: { ...type.body, color: color.dim, marginTop: space(3), marginBottom: space(6) },

  social: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(2.5),
    height: SOCIAL_H,
    // Matches the primary Button radius (16) so the social buttons and the CTA below read as one family.
    borderRadius: 16,
    marginBottom: space(3),
  },
  google: { backgroundColor: google.surface },
  apple: { backgroundColor: color.card, borderWidth: 1, borderColor: color.border2 },
  socialDisabled: { opacity: 0.5 },
  socialLabel: { ...type.bodyStrong, color: color.text },
  googleLabel: { color: google.onSurface },

  divider: { flexDirection: "row", alignItems: "center", gap: space(3.5), marginVertical: space(5) },
  rule: { flex: 1, height: 1, backgroundColor: color.border2 },
  or: { ...type.caption, color: color.dim2 },

  switch: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: space(6) },
  switchPrompt: { ...type.body, color: color.dim },
  switchAction: { ...type.bodyStrong, color: color.redLight },
});
