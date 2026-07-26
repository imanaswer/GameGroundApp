/**
 * DESIGN_SYSTEM.md §9 — every screen ships loading / empty / error / offline.
 * ErrorState renders the server `error` verbatim + retry; OfflineBanner is the thin strip.
 */
import { StyleSheet, Text, View } from "react-native";

import { AlertIcon, Button, OfflineIcon } from "@/components/ds";
import { color, icon as iconSize, layout, space, type } from "@/lib/tokens";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.tile}>
        <AlertIcon size={iconSize.empty} color={color.redLight} />
      </View>
      <Text style={styles.headline}>Something went wrong</Text>
      <Text style={styles.body}>{message}</Text>
      <Button title="Try again" onPress={onRetry} style={styles.cta} />
    </View>
  );
}

export function OfflineBanner() {
  return (
    <View style={styles.banner}>
      <OfflineIcon size={14} color={color.dim} />
      <Text style={styles.bannerText}>You’re offline — showing saved content</Text>
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
  },
  headline: { ...type.title2, color: color.text, textAlign: "center" },
  body: { ...type.body, color: color.dim, textAlign: "center", maxWidth: 280 },
  cta: { marginTop: space(2), alignSelf: "stretch" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space(2),
    backgroundColor: color.card,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
    paddingVertical: space(2),
  },
  bannerText: { ...type.caption, color: color.dim },
});
