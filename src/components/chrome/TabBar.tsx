/**
 * DESIGN_SYSTEM.md §5 TabBar + MOTION.md §2 tab-switch.
 * 5 items, 70pt + safe area, OPAQUE `tabBarBg` fill, hairline top border. Item: 20pt icon + 10px
 * label. The fill covers the safe-area inset too, so the bar meets the bottom of the screen.
 *
 * Active state is INK, not accent (Decision 20 / the source system): the selected item is `text` at the
 * bold weight, everything else is `dim`. No indicator bar and no tinted halo — the source system
 * has no brand accent in its nav, and a red wash under the selected tab was the loudest thing on
 * a white page. Colour is never the only channel, so the label changes weight too.
 *
 * The active state TRACKS THE SWIPE. Decision 17 made the tab layer horizontally paged, and the
 * navigator hands its `position` (a react-native `Animated` value, 0…n across the pager) to the
 * bar. Every item cross-fades an idle layer against an ink layer off that value, so a half-finished
 * drag shows a half-lit tab and following the gesture back leaves the bar where it started.
 * `state.index` only settles at the end of the gesture and would make the bar snap.
 *
 * Two consequences worth knowing before editing:
 *  - `position` is react-native's `Animated`, NOT Reanimated. This file therefore uses RN Animated
 *    throughout; mixing the two on one node is what makes tab bars jitter. Only `opacity` and
 *    `transform` are touched, which are the two native-driver-safe props.
 *  - The two label layers are STACKED, not swapped. Bold measures wider than medium, so re-styling
 *    one Text in place would re-lay-out the item on every switch and jog the row.
 *
 * Selection haptic on switch. Reduced motion drops the scale and keeps the cross-fade — a fade is
 * the standard substitute for movement, not something to suppress.
 *
 * Drives the tab navigator via its `tabBar` prop; the per-route icon/title come straight from
 * each screen's `options` so the tab list stays declared in one place (app/(tabs)/_layout).
 */
// Material-top-tabs since Decision 17 made the tab layer swipe-paged (the navigator pins this bar
// to the bottom). Same state/descriptors/navigation shape as bottom-tabs, so only the type moved.
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import * as haptics from "@/lib/haptics";
import { color, font, space } from "@/lib/tokens";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const BAR_H = 70;

/** How far the ink icon grows at full selection. Small — nothing else marks the switch now. */
const POP = 0.06;

/** Base bar height excluding the safe-area inset. */
export const TAB_BAR_HEIGHT = BAR_H;

/**
 * Bottom padding a scrollable tab screen needs so its last content clears the (absolute,
 * blur-overlay) tab bar. The bar floats over content by design, so screens pad for it.
 */
export function useTabBarPadding(extra = space(4)) {
  const insets = useSafeAreaInsets();
  return BAR_H + insets.bottom + extra;
}

/** One rendered tab. `icon` is called twice per item — once per cross-fade layer. */
export type TabBarItem = {
  key: string;
  label: string;
  icon: (tint: string, focused: boolean) => React.ReactNode;
  onPress: () => void;
  testID?: string;
};

export function TabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const items: TabBarItem[] = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const focused = state.index === index;

    return {
      key: route.key,
      label:
        typeof options.tabBarLabel === "string"
          ? options.tabBarLabel
          : (options.title ?? route.name),
      icon: (tint, isFocused) => options.tabBarIcon?.({ focused: isFocused, color: tint }),
      // Route name, not label — copy changes must not break E2E selectors.
      testID: `tab-${route.name}`,
      onPress: () => {
        const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) {
          haptics.selection();
          navigation.navigate(route.name, route.params);
        }
      },
    };
  });

  return <TabBarView items={items} index={state.index} position={position} />;
}

/**
 * The bar without the navigator — so the catalog (DS §10.3) can render it in every state, and so
 * the navigator-facing wrapper above stays a pure mapping of descriptors onto props.
 *
 * `position` is optional: without a pager there is nothing to track, and selection sits statically
 * on `index`.
 */
export function TabBarView({
  items,
  index,
  position,
  floating = true,
}: {
  items: TabBarItem[];
  index: number;
  position?: Animated.AnimatedInterpolation<number>;
  /** False pins the bar into normal flow (catalog previews) instead of over the screen. */
  floating?: boolean;
}) {
  const styles = useThemedStyles(sheets);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  // Static stand-in for the pager value. Created once; `index` is pushed into it so a preview can
  // still change tabs. Kept outside the conditional so the hook order never moves.
  const standin = useRef(new Animated.Value(index)).current;
  useEffect(() => {
    if (!position) standin.setValue(index);
  }, [index, position, standin]);
  const pos = position ?? standin;

  const bottomPad = floating ? insets.bottom : 0;

  return (
    <View
      style={[
        styles.wrap,
        floating && styles.floating,
        { height: BAR_H + bottomPad, paddingBottom: bottomPad },
      ]}
    >
      {/* Opaque fill (tabBarBg), covering the safe-area inset as well as the row. It was translucent
          — the tint that was meant to sit ON a BlurView, kept after Decision 11 removed the
          BlurView, so content scrolled visibly through the tab labels. If expo-blur ever comes back
          behind a rebuild, this view is where it goes and the token returns to a tint (DS §5). */}
      <View style={styles.fill} pointerEvents="none" />
      <View style={styles.row}>
        {items.map((item, i) => (
          <TabItem
            key={item.key}
            item={item}
            focused={index === i}
            // 1 at this item, 0 at either neighbour, and every value between while a drag is in
            // flight. Clamped so the first and last tabs don't re-light past the pager's ends.
            progress={pos.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            })}
            reduced={reduced}
          />
        ))}
      </View>
    </View>
  );
}

function TabItem({
  item,
  focused,
  progress,
  reduced,
}: {
  item: TabBarItem;
  focused: boolean;
  progress: Animated.AnimatedInterpolation<number>;
  reduced: boolean;
}) {
  const styles = useThemedStyles(sheets);
  const palette = usePalette();

  const idle = Animated.subtract(1, progress);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + POP] });

  return (
    <Pressable
      testID={item.testID}
      style={styles.item}
      onPress={item.onPress}
      // `tab`, not `button` — with role=button VoiceOver/TalkBack drop the selected state on the
      // way out, and selection is the only thing this control communicates.
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={item.label}
    >
      <Animated.View style={[styles.iconWrap, !reduced && { transform: [{ scale }] }]}>
        <Animated.View style={[styles.layer, { opacity: idle }]}>
          {item.icon(palette.dim, false)}
        </Animated.View>
        <Animated.View style={[styles.layer, { opacity: progress }]}>
          {item.icon(palette.text, true)}
        </Animated.View>
      </Animated.View>

      {/* The bold layer is in flow and sizes the box; the medium one is laid over it. Both are
          always mounted, so the item's width never changes and the row never jogs.
          The box stretches so a label wider than its share of the row (large font scale, a longer
          route title) ellipsises inside the item instead of overflowing both sides and being
          shaved by the bar's `overflow: hidden` — the CoachCard clipping bug in miniature. */}
      <View style={styles.labels}>
        <Animated.Text
          style={[styles.label, styles.labelActive, { color: palette.text, opacity: progress }]}
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
        <Animated.Text
          style={[styles.label, styles.labelIdle, { color: palette.dim, opacity: idle }]}
          numberOfLines={1}
        >
          {item.label}
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const sheets = themed(() => ({
  wrap: {
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    overflow: "hidden",
  },
  floating: { position: "absolute" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: color.tabBarBg },
  row: { flex: 1, flexDirection: "row" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  iconWrap: { width: 40, height: 24, alignItems: "center", justifyContent: "center" },
  layer: { position: "absolute", alignItems: "center", justifyContent: "center" },
  labels: { alignSelf: "stretch" },
  // The 2pt inset goes on the shared label style, not the wrapper: `labelIdle` is absolutely
  // positioned, and absolute children resolve left/right against the PADDING box, so padding on
  // the wrapper would give the two layers different widths and different ellipsis points.
  label: {
    fontFamily: font.sansMedium,
    fontSize: 10,
    lineHeight: 12,
    textAlign: "center",
    alignSelf: "stretch",
    paddingHorizontal: 2,
  },
  /** Weight, not colour alone, is the second selection channel — see the header note. */
  labelActive: { fontFamily: font.sansBold },
  labelIdle: { position: "absolute", left: 0, right: 0, top: 0 },
}));
