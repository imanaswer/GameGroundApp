/**
 * DESIGN_SYSTEM.md §5 EmptyState. Floating icon tile + serif headline + body + CTA.
 * Copy comes from MOTION.md §6 catalog — callers pass exact strings, never improvised.
 */
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ds";
import { color, layout, space, type } from "@/lib/tokens";

export function EmptyState({
  icon,
  headline,
  body,
  cta,
  secondary,
}: {
  icon: React.ReactNode;
  headline: string;
  body?: string;
  cta?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.tile}>{icon}</View>
      <Text style={styles.headline}>{headline}</Text>
      {!!body && <Text style={styles.body}>{body}</Text>}
      {cta && <Button title={cta.label} onPress={cta.onPress} style={styles.cta} />}
      {secondary && <Button title={secondary.label} variant="ghost" onPress={secondary.onPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: layout.screenX, gap: space(3) },
  tile: {
    width: 66,
    height: 66,
    borderRadius: 999,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(1),
  },
  headline: { ...type.title2, color: color.text, textAlign: "center" },
  body: { ...type.body, color: color.dim, textAlign: "center", maxWidth: 280 },
  cta: { marginTop: space(2), alignSelf: "stretch" },
});
