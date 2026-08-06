/**
 * DESIGN_SYSTEM.md §5 StickyCTA. Bottom-pinned SOLID bar with a hairline top edge, safe-area aware.
 * Price block + optional Button. Success-morph is wired in M6 (server-confirmed only).
 *
 * **It was a `ctaFade` gradient and is now a surface.** The fade ramped from transparent to 95% page
 * colour over 32pt, which meant whatever was scrolling underneath showed through the top of the bar
 * half-dissolved — on the coach screen, the bottom of a `card`-filled batch row read as a grey smear
 * above the price. Reported on device by Anaswer. Same defect as the tab bar's leftover translucency
 * (Decision 11 removed the BlurView those tints were drawn for): without a blur there is nothing to
 * make partial transparency read as depth, so it just reads as dirt. Screens already pad their
 * scroll content past this bar, so nothing is hidden by making it opaque.
 *
 * **The action is optional.** Without `ctaLabel`/`onPress` the bar is the price block alone. That is
 * for a gate whose answer is "not yet, and not from here": a disabled button plus a caption
 * explaining the disablement is more chrome saying less than showing no button at all.
 */
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, CheckIcon } from "@/components/ds";
import { color, layout, space, type } from "@/lib/tokens";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

export function StickyCTA({
  price,
  caption,
  status,
  ctaLabel,
  onPress,
  buttonVariant = "primary",
  loading = false,
  disabled = false,
  testID,
}: {
  /** Rendered as "FREE" when null. Ignored when `status` is set. */
  price?: string | null;
  caption?: string;
  /** A confirmed state (e.g. "You're in") — replaces the price block with a success-tinted label. */
  status?: string;
  /** Omit BOTH of these to render the bar with no action at all (see the note on the component). */
  ctaLabel?: string;
  onPress?: () => void;
  /** Demote the action (e.g. "Leave") to a secondary button so it never reads as the loud primary. */
  buttonVariant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  /** E2E hook (.maestro/) — lands on the CTA button, not the gradient wrapper. */
  testID?: string;
}) {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom + space(3) }]}>
      <View style={styles.row}>
        {status ? (
          <View style={styles.statusRow}>
            <CheckIcon size={16} color={color.successText} />
            <Text style={styles.status}>{status}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.price}>{price ?? "FREE"}</Text>
            {!!caption && <Text style={styles.caption}>{caption}</Text>}
          </View>
        )}
        {!!ctaLabel && !!onPress && (
          <Button testID={testID} title={ctaLabel} variant={buttonVariant} onPress={onPress} loading={loading} disabled={disabled} style={styles.cta} />
        )}
      </View>
    </View>
  );
}

const sheets = themed(() => ({
  // Solid, with the hairline carrying the boundary the fade used to imply. paddingTop is 12 rather
  // than the fade's 32: that 32 existed to give the gradient room to ramp, not to space the row.
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: layout.screenX,
    paddingTop: space(3),
    backgroundColor: color.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(4) },
  price: { fontFamily: type.heading.fontFamily, fontSize: 16, color: color.goldText },
  caption: { ...type.micro, color: color.dim },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space(2) },
  status: { ...type.bodyStrong, color: color.successText },
  cta: { flexShrink: 0 },
}));
