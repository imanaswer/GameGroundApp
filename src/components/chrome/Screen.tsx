import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color, layout } from "@/lib/tokens";

type Props = ViewProps & {
  /** Screens with their own hero/scrim manage horizontal padding themselves. */
  padded?: boolean;
};

/** Every screen's outermost element. Owns the app background and the 18pt gutter (DS §3). */
export function Screen({ padded = true, style, children, ...rest }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={[styles.body, padded && styles.padded, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  body: { flex: 1 },
  padded: { paddingHorizontal: layout.screenX },
});
