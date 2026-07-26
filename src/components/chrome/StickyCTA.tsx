/**
 * DESIGN_SYSTEM.md §5 StickyCTA. Bottom-pinned over ctaFade, safe-area aware.
 * Price block + primary Button. Success-morph is wired in M6 (server-confirmed only).
 */
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ds";
import { color, gradient, layout, space, type } from "@/lib/tokens";

export function StickyCTA({
  price,
  caption,
  ctaLabel,
  onPress,
  loading = false,
  disabled = false,
}: {
  /** Rendered as "FREE" when null. */
  price?: string | null;
  caption?: string;
  ctaLabel: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradient.ctaFade.colors as unknown as [string, string]}
      locations={gradient.ctaFade.locations as unknown as [number, number]}
      style={[styles.wrap, { paddingBottom: insets.bottom + space(3) }]}
    >
      <View style={styles.row}>
        <View>
          <Text style={styles.price}>{price ?? "FREE"}</Text>
          {!!caption && <Text style={styles.caption}>{caption}</Text>}
        </View>
        <Button title={ctaLabel} onPress={onPress} loading={loading} disabled={disabled} style={styles.cta} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenX, paddingTop: space(8) },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(4) },
  price: { fontFamily: type.heading.fontFamily, fontSize: 16, color: color.gold },
  caption: { ...type.micro, color: color.dim },
  cta: { flexShrink: 0 },
});
