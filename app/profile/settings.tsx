/**
 * Notification preferences (M11). Reached from the profile hub's "Notifications" row. The account
 * actions (payments, log out, delete) live on the profile hub itself — this screen is toggles only.
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { PageNav, Screen } from "@/components/chrome";
import { usePushPrefs } from "@/hooks/usePushPrefs";
import * as haptics from "@/lib/haptics";
import { PUSH_CATEGORIES } from "@/lib/pushCategories";
import { color, layout, radius, space, type } from "@/lib/tokens";

export default function NotificationSettings() {
  const router = useRouter();
  const { prefs, setPref } = usePushPrefs();

  return (
    <Screen padded={false}>
      <PageNav title="Notifications" onBack={router.back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {PUSH_CATEGORIES.map((c, i) => (
            <View key={c.key} style={[styles.toggleRow, i > 0 && styles.rowDivider]}>
              <Text style={styles.toggleLabel}>{c.label}</Text>
              <Switch
                value={prefs[c.key]}
                onValueChange={(v) => {
                  haptics.selection();
                  setPref(c.key, v);
                }}
                trackColor={{ true: color.red, false: color.border2 }}
                thumbColor={color.text}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(2), paddingBottom: space(16) },
  card: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space(3.5), paddingVertical: space(3) },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  toggleLabel: { ...type.body, color: color.text },
});
