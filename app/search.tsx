/**
 * Global search modal (M10). Debounced /search, grouped results, local recent searches.
 * Reached from any Header search icon; presented as a modal (root stack).
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { SearchHit, SearchResults } from "@/api/types";
import { Screen } from "@/components/chrome";
import { Chip, CloseIcon, Press, SearchBar, Skeleton } from "@/components/ds";
import { useSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/useDebounce";
import * as storage from "@/lib/storage";
import { color, layout, space, type } from "@/lib/tokens";

/**
 * Only the four groups the server actually searches. The web `/search` route queries coaches,
 * games, camps and events — workshops and players are NOT indexed, so listing them here promised
 * results that could never arrive. Add them back when the server does.
 */
const GROUPS: { key: keyof SearchResults; label: string; route: string }[] = [
  { key: "games", label: "Games", route: "game" },
  { key: "coaches", label: "Coaches", route: "coach" },
  { key: "camps", label: "Camps", route: "camp" },
  { key: "events", label: "Events", route: "event" },
];

const TRENDING = ["Football", "Cricket", "Badminton", "This weekend"];

export default function SearchModal() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const q = useDebounce(raw.trim(), 300);
  const { data, isFetching } = useSearch(q);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    storage.get("gg.recentSearches").then((r) => setRecent(r ?? []));
  }, []);

  const remember = async (term: string) => {
    const next = [term, ...recent.filter((t) => t !== term)].slice(0, 6);
    setRecent(next);
    await storage.set("gg.recentSearches", next);
  };

  const clearRecent = () => {
    setRecent([]);
    storage.set("gg.recentSearches", []);
  };

  const openHit = (route: string, hit: SearchHit) => {
    remember(q || hit.title);
    router.dismiss();
    // Route is composed at runtime from the result group; typed-routes can't narrow it.
    router.push((route === "profile" ? `/profile?userId=${hit.id}` : `/${route}/${hit.id}`) as never);
  };

  const hasResults = data && GROUPS.some((g) => data[g.key]?.length);

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <View style={styles.searchWrap}>
          <SearchBar value={raw} onChangeText={setRaw} placeholder="Search games, coaches, venues" autoFocus />
        </View>
        <Press accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.dismiss()} scaleTo={0.9} hitSlop={8} style={styles.close}>
          <CloseIcon color={color.text} />
        </Press>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {q.length < 2 ? (
          <>
            {recent.length > 0 && (
              <Section
                label="Recent"
                action={
                  <Press accessibilityRole="button" accessibilityLabel="Clear recent searches" hitSlop={8} onPress={clearRecent}>
                    <Text style={styles.clearAction}>Clear</Text>
                  </Press>
                }
              >
                <View style={styles.chips}>
                  {recent.map((t) => (
                    <Chip key={t} label={t} onPress={() => setRaw(t)} />
                  ))}
                </View>
              </Section>
            )}
            <Section label="Trending">
              <View style={styles.chips}>
                {TRENDING.map((t) => (
                  <Chip key={t} label={t} onPress={() => setRaw(t)} />
                ))}
              </View>
            </Section>
          </>
        ) : isFetching && !hasResults ? (
          <View style={styles.section}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={40} style={styles.skel} />
            ))}
          </View>
        ) : !hasResults ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches for “{q}”.</Text>
            <Text style={styles.emptyBody}>Try a sport, a venue, or a coach’s name.</Text>
          </View>
        ) : (
          GROUPS.map((g) => {
            const hits = data?.[g.key] ?? [];
            if (hits.length === 0) return null;
            return (
              <Section key={g.key} label={g.label}>
                {hits.map((hit) => (
                  <Press key={hit.id} onPress={() => openHit(g.route, hit)} style={styles.hit}>
                    <Text style={styles.hitTitle}>{hit.title}</Text>
                    {!!hit.subtitle && <Text style={styles.hitSub}>{hit.subtitle}</Text>}
                  </Press>
                ))}
              </Section>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: space(2), paddingHorizontal: layout.screenX, paddingTop: space(2), paddingBottom: space(3) },
  searchWrap: { flex: 1 },
  close: { width: 34, height: 34, borderRadius: 999, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: layout.screenX, paddingBottom: space(10), gap: space(4) },
  section: { gap: space(2) },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabel: { ...type.label, color: color.dim },
  clearAction: { ...type.bodyStrong, fontSize: 12, color: color.redLight },
  skel: { marginBottom: space(2) },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  hit: { paddingVertical: space(2.5) },
  hitTitle: { ...type.bodyStrong, color: color.text },
  hitSub: { ...type.caption, color: color.dim, marginTop: space(0.5) },
  empty: { alignItems: "center", paddingTop: space(12), gap: space(2) },
  emptyTitle: { ...type.title2, color: color.text, textAlign: "center" },
  emptyBody: { ...type.body, color: color.dim, textAlign: "center" },
});
