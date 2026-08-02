/** DESIGN_SYSTEM.md §5 Header. Brand lockup (mark + wordmark) / screen name + right icon buttons. */
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { Avatar, Press } from "@/components/ds";
import { color, font, layout, space, type } from "@/lib/tokens";

type Action = { key: string; icon: React.ReactNode; onPress: () => void; label: string };

/** The GameGround wing mark — tinted to brand red so it tracks the token, not the baked asset hue. */
const BRAND_MARK = require("../../../assets/images/logo-mark.png");

export function Header({
  title,
  subtitle,
  wordmark = false,
  actions = [],
  me,
}: {
  /** Home shows the "GameGround" wordmark; other screens show the screen name. */
  title: string;
  /** Optional line under the title, e.g. a live count ("4 pickup games live today"). */
  subtitle?: string;
  wordmark?: boolean;
  actions?: Action[];
  me?: { name: string; uri?: string | null; onPress: () => void };
}) {
  return (
    <View style={styles.row}>
      <View style={styles.titleWrap}>
        {wordmark ? (
          <View style={styles.brand} accessibilityRole="header" accessibilityLabel="GameGround">
            <Image source={BRAND_MARK} style={styles.brandMark} contentFit="contain" tintColor={color.red} />
            <Text style={styles.brandText} numberOfLines={1}>
              GameGround
            </Text>
          </View>
        ) : (
          <Text style={[styles.title, styles.screenName]} numberOfLines={1}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={styles.right}>
        {actions.map((a) => (
          <Press
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            scaleTo={0.9}
            hitSlop={8}
            onPress={a.onPress}
            style={styles.iconBtn}
          >
            {a.icon}
          </Press>
        ))}
        {me && (
          <Press accessibilityRole="button" accessibilityLabel="Profile" scaleTo={0.9} hitSlop={8} onPress={me.onPress}>
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
  titleWrap: { flexShrink: 1, minWidth: 0 },
  title: { color: color.text },
  subtitle: { ...type.body, color: color.dim, marginTop: space(1) },
  brand: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  brandMark: { width: 26, height: 19.5 },
  brandText: { fontFamily: font.sansExtra, fontSize: 18, lineHeight: 22, color: color.text, letterSpacing: -0.3 },
  screenName: { ...type.title1 },
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
