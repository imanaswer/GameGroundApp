/**
 * Full-screen brand loader — the source's Sign up 09 frame: a black field, the mark centred, and
 * a thin arc turning around it.
 *
 * Deliberately DARK in a light app. It is the same surface as the splash (Decision 18), and the
 * source agrees: its own splash and this loader are the only two black screens in the file. Both
 * are moments where the app is not yet showing content, so they belong to the brand rather than
 * to the UI — which is exactly why inverting them with the rest of the port would have been wrong.
 *
 * Rendered by `<HandoffProvider />` after a session is created (signup) or restored (login), while
 * the tabs mount underneath. It covers a real wait; it must never be shown on a timer for effect.
 * Mount it there rather than from a screen — see that file for why a screen cannot hold it.
 *
 * The ring is `<Spinner />` at brand scale. Same arc, same revolution, one implementation.
 */
import { Image, View } from "react-native";

import { color } from "@/lib/tokens";

import { Spinner } from "./Spinner";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const MARK = require("@/assets/images/splash-icon.png");

const RING = 108;

export function BrandLoader() {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  return (
    <View style={styles.field}>
      <Spinner size={RING} stroke={1.5} tint={color.inverse} style={styles.ring} />
      <Image source={MARK} style={styles.mark} resizeMode="contain" />
    </View>
  );
}

const sheets = themed(() => ({
  /**
   * `flex: 1`, NOT absoluteFill. This is returned as an entire screen, and an absolutely
   * positioned root contributes no size to its parent — if the container does not already
   * establish one, the view collapses and renders nothing at all. It was invisible on device for
   * exactly that reason, while every static check passed: nothing is wrong with the markup, it
   * simply had no height.
   *
   * `onInverse` is the token for true black. Not `bg` — this screen is deliberately not the page.
   */
  field: { flex: 1, backgroundColor: color.onInverse, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute" },
  // 4:3, matching the artwork's alpha bbox — the height moves with the width or the mark distorts.
  mark: { width: 64, height: 48 },
}));
