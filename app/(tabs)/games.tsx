/**
 * Games list (M5). FlashList feed, sport chips, 300ms-debounced search, status filter.
 * Screen composes — all data via useGames (§6.1). Every state ships (DS §9).
 */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { GameCard } from "@/components/cards";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, useTabBarPadding } from "@/components/chrome";
import { CardSkeleton, ChipRow, GamesIcon, SearchBar, SearchIcon } from "@/components/ds";
import { toGameCard, useGames } from "@/hooks/queries";
import { useDebounce } from "@/hooks/useDebounce";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

const SPORTS = [
  { key: "all", label: "All sports" },
  { key: "football", label: "Football" },
  { key: "cricket", label: "Cricket" },
  { key: "badminton", label: "Badminton" },
  { key: "basketball", label: "Basketball" },
  { key: "tennis", label: "Tennis" },
];

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
];

export default function GamesTab() {
  const router = useRouter();
  const [sport, setSport] = useState("all");
  const [status, setStatus] = useState<"open" | "all" | "completed">("open");
  const [rawQuery, setRawQuery] = useState("");
  const q = useDebounce(rawQuery.trim(), 300);

  const filters = { sport, status, q: q || undefined };
  const { data, isLoading, isError, error, refetch, isRefetching, isPaused } = useGames(filters);

  const empty = data && data.length === 0;
  const filtered = sport !== "all" || !!q;
  const bottomPad = useTabBarPadding();

  return (
    <Screen padded={false}>
      <Header
        title="Games"
        actions={[
          {
            key: "search",
            label: "Search",
            icon: <SearchIcon color={color.text} />,
            onPress: () => router.push("/search"),
          },
        ]}
      />
      {isPaused && <OfflineBanner />}
      <View style={styles.controls}>
        <SearchBar value={rawQuery} onChangeText={setRawQuery} placeholder="Search games or venues" />
      </View>
      <View style={styles.chips}>
        <ChipRow items={SPORTS} value={sport} onChange={setSport} />
      </View>
      <View style={styles.chips}>
        <ChipRow items={STATUSES} value={status} onChange={(k) => setStatus(k as typeof status)} />
      </View>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.rowGap}>
              <CardSkeleton />
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load games."} onRetry={refetch} />
      ) : empty ? (
        <EmptyState
          icon={<GamesIcon size={iconSize.empty} color={color.red} />}
          headline={filtered ? `No games for ${sport === "all" ? "that search" : sport} — yet.` : "No games tonight — yet."}
          body="Someone has to go first. Why not you?"
          cta={{ label: "Create one", onPress: () => router.push("/game/create") }}
        />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(g) => g.id}
          contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <GameCard data={toGameCard(item)} onPress={() => router.push(`/game/${item.id}`)} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                haptics.refresh();
                refetch();
              }}
              tintColor={color.dim}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: layout.screenX, paddingBottom: space(3) },
  chips: { paddingBottom: space(3) },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(24) },
  rowGap: { marginBottom: space(3) },
  sep: { height: space(3) },
});
