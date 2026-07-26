/**
 * Global search modal (M10). Debounced /search, grouped results, local recent searches.
 * Reached from any Header search icon; presented as a modal (root stack).
 */
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { SearchHit, SearchResults } from "@/api/types";
import { Screen } from "@/components/chrome";
import { Chip, CloseIcon, Press, SearchBar } from "@/components/ds";
import { useSearch } from "@/hooks/queries";
import { useDebounce } from "@/hooks/useDebounce";
import * as storage from "@/lib/storage";
import { color, layout, space, type } from "@/lib/tokens";

const GROUPS: { key: keyof SearchResults; label: string; route: string }[] = [
  { key: "games", label: "Games", route: "game" },
  { key: "coaches", label: "Coaches", route: "coach" },
  { key: "camps", label: "Camps", route: "camp" },
  { key: "workshops", label: "Workshops", route: "workshop" },
  { key: "events", label: "Events", route: "event" },
  { key: "players", label: "Players", route: "profile" },
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
        <Press accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.dismiss()} scaleTo={0.9} style={styles.close}>
          <CloseIcon color={color.text} />
        </Press>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {q.length < 2 ? (
          <>
            {recent.length > 0 && (
              <Section label="Recent">
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
        ) : !isFetching && !hasResults ? (
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

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
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
  sectionLabel: { ...type.label, color: color.dim },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  hit: { paddingVertical: space(2.5) },
  hitTitle: { ...type.bodyStrong, color: color.text },
  hitSub: { ...type.caption, color: color.dim, marginTop: space(0.5) },
  empty: { alignItems: "center", paddingTop: space(12), gap: space(2) },
  emptyTitle: { ...type.title2, color: color.text, textAlign: "center" },
  emptyBody: { ...type.body, color: color.dim, textAlign: "center" },
});
