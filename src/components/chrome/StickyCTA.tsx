/**
 * DESIGN_SYSTEM.md §5 StickyCTA. Bottom-pinned over ctaFade, safe-area aware.
 * Price block + primary Button. Success-morph is wired in M6 (server-confirmed only).
 */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, CheckIcon } from "@/components/ds";
import { color, gradient, layout, space, type } from "@/lib/tokens";

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
  ctaLabel: string;
  onPress: () => void;
  /** Demote the action (e.g. "Leave") to a secondary button so it never reads as the loud primary. */
  buttonVariant?: "primary" | "secondary";
  loading?: boolean;
  disabled?: boolean;
  /** E2E hook (.maestro/) — lands on the CTA button, not the gradient wrapper. */
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradient.ctaFade.colors as unknown as [string, string]}
      locations={gradient.ctaFade.locations as unknown as [number, number]}
      style={[styles.wrap, { paddingBottom: insets.bottom + space(3) }]}
    >
      <View style={styles.row}>
        {status ? (
          <View style={styles.statusRow}>
            <CheckIcon size={16} color={color.success} />
            <Text style={styles.status}>{status}</Text>
          </View>
        ) : (
          <View>
            <Text style={styles.price}>{price ?? "FREE"}</Text>
            {!!caption && <Text style={styles.caption}>{caption}</Text>}
          </View>
        )}
        <Button testID={testID} title={ctaLabel} variant={buttonVariant} onPress={onPress} loading={loading} disabled={disabled} style={styles.cta} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenX, paddingTop: space(8) },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(4) },
  price: { fontFamily: type.heading.fontFamily, fontSize: 16, color: color.gold },
  caption: { ...type.micro, color: color.dim },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space(2) },
  status: { ...type.bodyStrong, color: color.success },
  cta: { flexShrink: 0 },
});
