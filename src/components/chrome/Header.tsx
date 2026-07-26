/** DESIGN_SYSTEM.md §5 Header. Serif brand/screen name + right icon buttons. */
import { StyleSheet, Text, View } from "react-native";

import { Avatar, Press } from "@/components/ds";
import { color, layout, space, type } from "@/lib/tokens";

type Action = { key: string; icon: React.ReactNode; onPress: () => void; label: string };

export function Header({
  title,
  wordmark = false,
  actions = [],
  me,
}: {
  /** Home shows the "Game Ground" wordmark; other screens show the screen name. */
  title: string;
  wordmark?: boolean;
  actions?: Action[];
  me?: { name: string; uri?: string | null; onPress: () => void };
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.title, wordmark ? styles.wordmark : styles.screenName]} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        {actions.map((a) => (
          <Press
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            scaleTo={0.9}
            onPress={a.onPress}
            style={styles.iconBtn}
          >
            {a.icon}
          </Press>
        ))}
        {me && (
          <Press accessibilityRole="button" accessibilityLabel="Profile" scaleTo={0.9} onPress={me.onPress}>
            <Avatar name={me.name} uri={me.uri} size={34} isSelf />
          </Press>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenX,
    paddingBottom: space(3),
    gap: space(3),
  },
  title: { color: color.text, flexShrink: 1 },
  wordmark: { ...type.title2 },
  screenName: { ...type.title1, fontSize: 24 },
  right: { flexDirection: "row", alignItems: "center", gap: space(2) },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: color.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
