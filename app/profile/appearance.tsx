/**
 * Appearance (Decision 24) — light, dark, or follow the system.
 *
 * Three options and nothing else. "System" is the default and the one most people should be on;
 * the two explicit modes exist because a phone-wide setting is not always the right answer for
 * one app, not because the app has an opinion about which looks better.
 *
 * The choice applies the instant it is tapped — no Save, no confirm. A theme is its own preview,
 * and a preference screen that makes you commit before you can see the result is asking you to
 * guess.
 */
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { PageNav, Screen } from "@/components/chrome";
import { CheckIcon, Press } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import { color, layout, radius, space, type } from "@/lib/tokens";
import { useTheme, type ThemeMode } from "@/theme/ThemeProvider";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const OPTIONS: { mode: ThemeMode; label: string; hint: string }[] = [
  { mode: "system", label: "System", hint: "Match your phone's appearance setting." },
  { mode: "light", label: "Light", hint: "Always light, whatever the phone is set to." },
  { mode: "dark", label: "Dark", hint: "Always dark, whatever the phone is set to." },
];

export default function Appearance() {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const router = useRouter();
  const { mode, scheme, setMode } = useTheme();

  return (
    <Screen padded={false}>
      <PageNav title="Appearance" onBack={router.back} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {OPTIONS.map((o, i) => (
            <Press
              key={o.mode}
              testID={`appearance-${o.mode}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: mode === o.mode }}
              tilt={false}
              onPress={() => {
                haptics.selection();
                setMode(o.mode);
              }}
              style={[styles.row, i > 0 && styles.rowDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.hint}>{o.hint}</Text>
              </View>
              {/* A check, not a radio ring: the DS has no radio, and inventing one for three rows
                  is what §10 governance exists to prevent. */}
              {mode === o.mode && <CheckIcon size={18} color={color.text} />}
            </Press>
          ))}
        </View>
        {mode === "system" && (
          <Text style={styles.footnote}>
            Currently {scheme}. This follows your phone, so it changes when your phone does — including
            on a schedule, if you have one set.
          </Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const sheets = themed(() => ({
  scroll: { paddingHorizontal: layout.screenX, paddingTop: space(2), paddingBottom: space(16) },
  card: {
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(3),
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: color.border },
  rowText: { flex: 1, gap: space(0.5) },
  label: { ...type.body, color: color.text },
  hint: { ...type.caption, color: color.dim },
  footnote: { ...type.caption, color: color.dim, paddingHorizontal: space(1), paddingTop: space(3) },
}));
