/**
 * HTTP 426 blocking wall (Developer PRD §4.1.3). No dismiss, no back — the api client
 * routes here and the root Stack disables the gesture. Buttons deep-link to the stores.
 */
import { Linking, Platform, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/chrome";
import { Button, InfoIcon } from "@/components/ds";
import { color, icon as iconSize, layout, space, type } from "@/lib/tokens";

// ponytail: real store URLs land at M17 submission; bundle id is stable now.
const STORE_URL = Platform.select({
  ios: "https://apps.apple.com/app/id0000000000",
  android: "market://details?id=net.gameground.app",
  default: "https://www.gameground.net",
});

export default function UpgradeRequired() {
  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.tile}>
          <InfoIcon size={iconSize.empty} color={color.red} />
        </View>
        <Text style={styles.title}>Time to update</Text>
        <Text style={styles.body}>
          This version of Game Ground is no longer supported. Update to the latest to keep playing.
        </Text>
        <Button title="Update now" onPress={() => Linking.openURL(STORE_URL)} style={styles.cta} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space(3), paddingHorizontal: layout.screenX },
  tile: {
    width: 66,
    height: 66,
    borderRadius: 999,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: space(1),
  },
  title: { ...type.title1, color: color.text, textAlign: "center" },
  body: { ...type.body, color: color.dim, textAlign: "center", maxWidth: 300 },
  cta: { marginTop: space(3), alignSelf: "stretch" },
});
