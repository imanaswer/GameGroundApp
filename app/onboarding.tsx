/**
 * Welcome — the single unauthenticated landing screen, shown once (flag in storage).
 *
 * Replaces the former 3-slide swipe deck (Decision 19). Everything the deck said across three
 * pages is now one photographic screen: full-bleed image, scrim, brand mark, headline, one
 * paragraph, and the two account CTAs. Both CTAs set the onboarded flag, so a returning user
 * lands straight on login instead of re-reading this.
 *
 * Motion is deliberately minimal here (MOTION §8 first-paint): the copy block rises and fades in
 * once on mount. No swipe, no dots, no autoplay — there is nothing left to page through.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Screen } from "@/components/chrome";
import { Appear } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import * as storage from "@/lib/storage";
import { color, gradient, layout, space, type } from "@/lib/tokens";

const PHOTO = require("@/assets/images/onboarding/welcome.jpg");
const MARK = require("@/assets/images/splash-icon.png");

/**
 * Welcome copy. Deliberately built on the reference's shape — brand name as headline, then one
 * declarative sentence with a three-part list — because a list of three lands harder than the
 * three hedged clauses this replaced ("games filling up tonight, coaches who actually level you
 * up, and…"). Keep it to a single sentence: `display` is 39px and the body is capped at 340pt,
 * so anything longer pushes the CTAs toward the home indicator.
 */
const HEADLINE = "GameGround";
const BODY = "Bringing players the best games, coaches and competition in your city.";

/**
 * The welcome CTAs. Not `Button`: DS §4 buttons are red/ghost on the app's black, and over
 * photography red loses contrast while `border2` (12% white) disappears entirely. These are the
 * inverted pair — see DESIGN_SYSTEM §4 "Inverted CTA (photographic surfaces)".
 */
function Pill({
  label,
  onPress,
  filled,
  testID,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  testID?: string;
}) {
  return (
    <Press
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      style={[styles.pill, filled ? styles.pillFilled : styles.pillOutlined]}
    >
      <Text style={[styles.pillLabel, filled && styles.pillLabelFilled]}>{label}</Text>
    </Press>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Mark onboarding seen before routing, so a kill mid-signup doesn't replay this screen.
  const go = (href: "/signup" | "/login") => async () => {
    await storage.set("gg.onboarded", true);
    router.replace(href);
  };

  return (
    <Screen padded={false} fullBleed>
      <Image source={PHOTO} style={StyleSheet.absoluteFill} contentFit="cover" transition={220} />
      {/* NOT heroScrim — that one is at 98% black by mid-screen and flattens a full-bleed photo
          into a black rectangle. This keeps the image readable through the top ~70%. */}
      <LinearGradient
        colors={gradient.welcomeScrim.colors}
        locations={gradient.welcomeScrim.locations}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          { paddingBottom: Math.max(space(8), insets.bottom + space(5)), paddingTop: insets.top },
        ]}
      >
        <Appear style={styles.copy}>
          <Image source={MARK} style={styles.mark} contentFit="contain" />
          <Text style={styles.headline}>{HEADLINE}</Text>
          <Text style={styles.body}>{BODY}</Text>
        </Appear>

        <View style={styles.ctas}>
          <Pill testID="welcome-join" label="Join Us" filled onPress={go("/signup")} />
          <Pill testID="welcome-signin" label="Sign In" onPress={go("/login")} />
        </View>
      </View>
    </Screen>
  );
}

const PILL_H = 52;

const styles = StyleSheet.create({
  // Bottom-anchored: the photo owns the top two-thirds, copy and CTAs sit in the scrim.
  content: { flex: 1, justifyContent: "flex-end", paddingHorizontal: layout.screenX, gap: space(6) },
  copy: { gap: space(3) },
  mark: { width: 58, height: 58, marginBottom: space(2) },
  headline: { ...type.display, color: color.inverse },
  // maxWidth keeps the paragraph off a ragged 2-word last line on wide phones.
  body: { ...type.body, color: color.inverse, opacity: 0.86, maxWidth: 340 },

  ctas: { flexDirection: "row", gap: space(3) },
  pill: {
    flex: 1,
    height: PILL_H,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  pillFilled: { backgroundColor: color.inverse },
  pillOutlined: { borderWidth: 1, borderColor: color.inverseBorder },
  pillLabel: { ...type.heading, color: color.inverse },
  pillLabelFilled: { color: color.onInverse },
});
