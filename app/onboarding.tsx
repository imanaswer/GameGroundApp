/**
 * 3-slide onboarding, shown once (flag in storage). Skip or finish → login.
 * Display type is the only place the serif goes this large (DS §2 display, red accent word).
 *
 * Motion (MOTION.md): an ambient top red glow, headline/body that fade + rise as each slide
 * centers (gesture-linked, not autoplay), page dots that widen/redden with the swipe, and a
 * selection haptic on every page turn.
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { Screen } from "@/components/chrome";
import { Button } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import * as storage from "@/lib/storage";
import { color, layout, space, type } from "@/lib/tokens";

const SLIDES = [
  { key: "find", lead: "Find your", accent: "next game", body: "Football, cricket, badminton — games near you, filling up tonight." },
  { key: "learn", lead: "Learn from", accent: "real coaches", body: "Book batches, read reviews, level up your game." },
  { key: "play", lead: "Play more,", accent: "climb higher", body: "Earn reputation, rise through the tiers, top the leaderboard." },
] as const;

type Slide = (typeof SLIDES)[number];

/** Top-anchored red radial glow — the same ambient signature as the auth screens. */
function OnboardingGlow() {
  const { width } = useWindowDimensions();
  const height = 380;
  return (
    <View pointerEvents="none" style={styles.glow}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="obGlow" cx="50%" cy="0%" rx="75%" ry="100%" fx="50%" fy="0%">
            <Stop offset="0" stopColor={color.red} stopOpacity={0.2} />
            <Stop offset="1" stopColor={color.red} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill="url(#obGlow)" />
      </Svg>
    </View>
  );
}

function SlideView({ item, index, scrollX, width }: { item: Slide; index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      opacity: interpolate(scrollX.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ translateY: interpolate(scrollX.value, input, [28, 0, 28], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.slideInner, style]}>
        <Text style={styles.display}>
          {item.lead} <Text style={styles.accent}>{item.accent}</Text>
        </Text>
        <Text style={styles.body}>{item.body}</Text>
      </Animated.View>
    </View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: SharedValue<number>; width: number }) {
  const style = useAnimatedStyle(() => {
    const input = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, input, [7, 22, 7], Extrapolation.CLAMP),
      backgroundColor: interpolateColor(scrollX.value, input, [color.border2, color.red, color.border2]),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const last = index === SLIDES.length - 1;

  const finish = async () => {
    await storage.set("gg.onboarded", true);
    router.replace("/login");
  };

  const next = () => {
    if (last) return finish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen padded={false}>
      <OnboardingGlow />
      <View style={styles.topBar}>
        <Button title="Skip" variant="ghost" onPress={finish} />
      </View>
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        // Fixed full-width pages → scrollToIndex is always safe; the fallback covers a cold first mount.
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onScrollToIndexFailed={(info) => listRef.current?.scrollToOffset({ offset: info.index * width, animated: true })}
        onMomentumScrollEnd={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / width);
          if (i !== index) {
            haptics.selection();
            setIndex(i);
          }
        }}
        renderItem={({ item, index: i }) => <SlideView item={item} index={i} scrollX={scrollX} width={width} />}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(space(10), insets.bottom + space(4)) }]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} index={i} scrollX={scrollX} width={width} />
          ))}
        </View>
        <Button title={last ? "Get started" : "Next"} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", top: 0, left: 0, right: 0 },
  topBar: { alignItems: "flex-end", paddingHorizontal: layout.screenX, paddingTop: space(2) },
  slide: { flex: 1, justifyContent: "center", paddingHorizontal: layout.screenX },
  slideInner: { gap: space(4) },
  display: { ...type.display, color: color.text },
  accent: { color: color.redLight, fontStyle: "italic" },
  body: { ...type.body, color: color.dim, maxWidth: 320 },
  footer: { paddingHorizontal: layout.screenX, gap: space(5) },
  dots: { flexDirection: "row", gap: space(1.5), justifyContent: "center", alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: color.border2 },
});
