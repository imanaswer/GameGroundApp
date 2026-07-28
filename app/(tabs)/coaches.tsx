/** Coaches directory (M8). Sport filter + search, CoachCard list, every state (DS §9). */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { CoachCard } from "@/components/cards";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, useTabBarPadding } from "@/components/chrome";
import { CardSkeleton, ChipRow, CoachesIcon, SearchBar } from "@/components/ds";
import { toCoachCard, useCoaches } from "@/hooks/queries";
import { useDebounce } from "@/hooks/useDebounce";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

const SPORTS = [
  { key: "all", label: "All sports" },
  { key: "football", label: "Football" },
  { key: "cricket", label: "Cricket" },
  { key: "badminton", label: "Badminton" },
  { key: "tennis", label: "Tennis" },
  { key: "swimming", label: "Swimming" },
];

export default function CoachesTab() {
  const router = useRouter();
  const [sport, setSport] = useState("all");
  const [rawQuery, setRawQuery] = useState("");
  const q = useDebounce(rawQuery.trim(), 300);
  const { data, isLoading, isError, error, refetch, isRefetching, isPaused } = useCoaches({
    sport,
    q: q || undefined,
  });
  const empty = data && data.length === 0;
  const bottomPad = useTabBarPadding();

  return (
    <Screen padded={false}>
      <Header title="Coaches" />
      {isPaused && <OfflineBanner />}
      <View style={styles.controls}>
        <SearchBar value={rawQuery} onChangeText={setRawQuery} placeholder="Search coaches" />
      </View>
      <View style={styles.chips}>
        <ChipRow items={SPORTS} value={sport} onChange={setSport} />
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
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load coaches."} onRetry={refetch} />
      ) : empty ? (
        <EmptyState
          icon={<CoachesIcon size={iconSize.empty} color={color.red} />}
          headline={sport === "all" ? "No coaches yet." : `No ${sport} coaches here yet.`}
          body="Try another sport."
        />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <CoachCard data={toCoachCard(item)} onPress={() => router.push(`/coach/${item.id}`)} />
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
