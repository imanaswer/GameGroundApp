import { StyleSheet, View, type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { color, layout } from "@/lib/tokens";

type Props = ViewProps & {
  /** Screens with their own hero/scrim manage horizontal padding themselves. */
  padded?: boolean;
  /**
   * Let content run under the status bar. The default insets the whole screen by the top safe
   * area, which means a screen painting its own background — the onboarding and auth red glow —
   * starts *below* the notch and leaves a flat `color.bg` strip above it. Full-bleed screens take
   * responsibility for insetting their own content via `useSafeAreaInsets()`.
   */
  fullBleed?: boolean;
};

/** Every screen's outermost element. Owns the app background and the 18pt gutter (DS §3). */
export function Screen({ padded = true, fullBleed = false, style, children, ...rest }: Props) {
  return (
    <SafeAreaView style={styles.root} edges={fullBleed ? [] : ["top"]}>
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
