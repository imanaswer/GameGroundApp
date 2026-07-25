import { StyleSheet, Text, View } from "react-native";

import { color, layout, space, type } from "@/lib/tokens";

import { Screen } from "./Screen";

/**
 * M0 scaffold stand-in. Every route renders one until its milestone builds the real screen.
 * Deleting the last usage of this file is how you know the scaffold is fully replaced.
 */
export function Placeholder({ route, milestone }: { route: string; milestone: string }) {
  return (
    <Screen>
      <View style={styles.center}>
        <Text style={styles.label}>{milestone}</Text>
        <Text style={styles.title}>{route}</Text>
        <Text style={styles.body}>Scaffolded in M0. Real screen lands in {milestone}.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space(2) },
  label: { ...type.label, color: color.dim },
  title: { ...type.title1, color: color.text, textAlign: "center" },
  body: { ...type.body, color: color.dim2, textAlign: "center", maxWidth: layout.screenX * 16 },
});
