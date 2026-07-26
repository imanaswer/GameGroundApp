/**
 * 3-slide onboarding, shown once (flag in storage). Skip or finish → login.
 * Display type is the only place the serif goes this large (DS §2 display, red accent word).
 */
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { Screen } from "@/components/chrome";
import { Button } from "@/components/ds";
import * as storage from "@/lib/storage";
import { color, layout, space, type } from "@/lib/tokens";

const SLIDES = [
  { key: "find", lead: "Find your", accent: "next game", body: "Football, cricket, badminton — games near you, filling up tonight." },
  { key: "learn", lead: "Learn from", accent: "real coaches", body: "Book batches, read reviews, level up your game." },
  { key: "play", lead: "Play more,", accent: "climb higher", body: "Earn reputation, rise through the tiers, top the leaderboard." },
] as const;

export default function Onboarding() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);
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
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Text style={styles.display}>
              {item.lead} <Text style={styles.accent}>{item.accent}</Text>
            </Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button title={last ? "Get started" : "Next"} onPress={next} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: "flex-end", paddingHorizontal: layout.screenX, paddingTop: space(2) },
  slide: { flex: 1, justifyContent: "center", paddingHorizontal: layout.screenX, gap: space(4) },
  display: { ...type.display, color: color.text },
  accent: { color: color.redLight, fontStyle: "italic" },
  body: { ...type.body, fontSize: 15, lineHeight: 22, color: color.dim, maxWidth: 320 },
  footer: { paddingHorizontal: layout.screenX, paddingBottom: space(10), gap: space(5) },
  dots: { flexDirection: "row", gap: space(1.5), justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: color.border2 },
  dotActive: { backgroundColor: color.red, width: 20 },
});
