/**
 * Settings (M11). Notification toggles (UI now — wired to server prefs in M12), payments
 * link, logout, and GDPR account deletion (server rotates identifiers → hard logout).
 */
import { useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

import { HeroNav, Screen } from "@/components/chrome";
import { CardIcon, ChevronRightIcon, LogOutIcon, Press, TrashIcon } from "@/components/ds";
import { useDeleteAccount } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { usePushPrefs } from "@/hooks/usePushPrefs";
import * as haptics from "@/lib/haptics";
import { PUSH_CATEGORIES } from "@/lib/pushCategories";
import { color, layout, radius, space, type } from "@/lib/tokens";

export default function Settings() {
  const router = useRouter();
  const { logout } = useAuth();
  const del = useDeleteAccount();
  const { prefs, setPref } = usePushPrefs();

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and data. This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            del.mutate(undefined, {
              onSuccess: async () => {
                haptics.destructive();
                await logout(); // hard logout after server identifier rotation
                router.replace("/login");
              },
              onError: (e) => Alert.alert("Couldn’t delete account", (e as Error).message),
            }),
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <View style={styles.nav}>
        <HeroNav onBack={router.back} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.section}>Notifications</Text>
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

        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <Press onPress={() => router.push("/profile/payments")} style={styles.linkRow}>
            <CardIcon color={color.dim} />
            <Text style={styles.linkLabel}>Payment history</Text>
            <ChevronRightIcon color={color.dim2} />
          </Press>
          <Press onPress={() => logout().then(() => router.replace("/login"))} style={[styles.linkRow, styles.rowDivider]}>
            <LogOutIcon color={color.dim} />
            <Text style={styles.linkLabel}>Log out</Text>
            <ChevronRightIcon color={color.dim2} />
          </Press>
        </View>

        <Press onPress={confirmDelete} style={styles.deleteRow}>
          <TrashIcon color={color.redLight} />
          <Text style={styles.deleteLabel}>Delete account</Text>
        </Press>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: space(6) },
  scroll: { paddingHorizontal: layout.screenX, paddingBottom: space(16), gap: space(3) },
  title: { ...type.title1, color: color.text, marginBottom: space(1) },
  section: { ...type.label, color: color.dim, marginTop: space(3) },
  card: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, overflow: "hidden" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space(3.5), paddingVertical: space(3) },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  toggleLabel: { ...type.body, color: color.text },
  linkRow: { flexDirection: "row", alignItems: "center", gap: space(3), paddingHorizontal: space(3.5), paddingVertical: space(3.5) },
  linkLabel: { ...type.body, color: color.text, flex: 1 },
  deleteRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2), paddingVertical: space(4), marginTop: space(4) },
  deleteLabel: { ...type.bodyStrong, color: color.redLight },
});
