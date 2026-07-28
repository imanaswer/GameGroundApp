/**
 * DESIGN_SYSTEM.md §5 TabBar + MOTION.md §2 tab-switch.
 * 5 items, 70pt + safe area, bg rgba(5,5,5,.88) + blur 16, hairline top border.
 * Item: 20pt icon + 9px/600 label. Active = red + icon spring.pop + 22px indicator bar + halo.
 * Selection haptic on switch. Reduced-motion holds the active state without the spring.
 *
 * Drives expo-router's <Tabs> via its `tabBar` prop; the per-route icon/title come straight
 * from each screen's `options` so the tab list stays declared in one place (app/(tabs)/_layout).
 */
import { BlurView } from "expo-blur";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs/types";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as haptics from "@/lib/haptics";
import { color, font, icon as iconSize } from "@/lib/tokens";
import { spring } from "@/theme/animations";

const BAR_H = 70;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { height: BAR_H + insets.bottom, paddingBottom: insets.bottom }]}>
      <BlurView intensity={16} tint="dark" style={StyleSheet.absoluteFill} />
      {/* Translucent fill sits over the blur so the bar reads correctly even before a native
          rebuild picks up expo-blur (blur renders transparent until then). */}
      <View style={styles.fill} pointerEvents="none" />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const tint = focused ? color.red : color.dim2;
          const glyph = options.tabBarIcon?.({ focused, color: tint, size: iconSize.tab });

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptics.selection();
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              tint={tint}
              glyph={glyph}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({
  focused,
  label,
  tint,
  glyph,
  onPress,
}: {
  focused: boolean;
  label: string;
  tint: string;
  glyph: React.ReactNode;
  onPress: () => void;
}) {
  const p = useSharedValue(focused ? 1 : 0);
  const reduced = useReducedMotion();

  useEffect(() => {
    p.value = reduced ? (focused ? 1 : 0) : withSpring(focused ? 1 : 0, spring.pop);
  }, [focused, reduced, p]);

  const indicatorStyle = useAnimatedStyle(() => ({ width: p.value * 22, opacity: p.value }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + p.value * 0.12 }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.6 + p.value * 0.5 }] }));

  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
    >
      <Animated.View style={[styles.indicator, indicatorStyle]} />
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.halo, haloStyle]} pointerEvents="none" />
        <Animated.View style={iconStyle}>{glyph}</Animated.View>
      </View>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    overflow: "hidden",
  },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.tabBarBg },
  row: { flex: 1, flexDirection: "row" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingTop: 8 },
  indicator: { position: "absolute", top: 0, height: 2.5, borderRadius: 999, backgroundColor: color.red },
  iconWrap: { width: 40, height: 24, alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: color.redSurface,
  },
  label: { fontFamily: font.sansSemi, fontSize: 9, lineHeight: 12 },
});
