/**
 * Coaches directory (M8). Sport chips are derived from the coaches that actually exist and filtered
 * client-side — the web `/coaches` sport filter is unreliable (case-sensitive, odd values like
 * "BOXING/KICK"). Search lives in the header icon → /search modal. Every state ships (DS §9).
 */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { CoachCard } from "@/components/cards";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, useTabBarPadding } from "@/components/chrome";
import { Appear, CardSkeleton, ChipRow, CoachesIcon, SearchIcon } from "@/components/ds";
import { toCoachCard, useCoaches } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { prettySport } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

export default function CoachesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [sport, setSport] = useState("all");
  const { data, isLoading, isError, error, refetch, isRefetching, isPaused } = useCoaches({});

  const chips = useMemo(() => {
    const unique = Array.from(new Set((data ?? []).map((c) => c.sport).filter(Boolean)));
    return [
      { key: "all", label: "All" },
      // Sort on the LABEL, not the raw value: server casing is inconsistent, and a plain sort()
      // puts "BOXING/KICK" before "Badminton" because uppercase sorts first in ASCII.
      ...unique
        .map((s) => ({ key: s, label: prettySport(s) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [data]);

  const coaches = useMemo(
    () => (sport === "all" ? data ?? [] : (data ?? []).filter((c) => c.sport === sport)),
    [data, sport],
  );

  const empty = data && coaches.length === 0;
  const bottomPad = useTabBarPadding();

  return (
    <Screen padded={false}>
      <Header
        title="Coaches"
        actions={[
          {
            key: "search",
            label: "Search",
            icon: <SearchIcon color={color.text} />,
            onPress: () => router.push("/search"),
          },
        ]}
        me={user ? { name: user.name, uri: user.avatarUrl, onPress: () => router.push("/profile") } : undefined}
      />
      {isPaused && <OfflineBanner />}
      <View style={styles.chips}>
        <ChipRow items={chips} value={sport} onChange={setSport} />
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
          headline={sport === "all" ? "No coaches yet." : `No ${prettySport(sport)} coaches yet.`}
          body="Try another sport."
        />
      ) : (
        // Keyed on the sport so a chip change re-runs the entrance (MOTION §2); the filter is
        // client-side, so without this the list would swap with no transition at all.
        <Appear key={sport} style={styles.listWrap}>
          <FlashList
            data={coaches}
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
        </Appear>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingBottom: space(3) },
  listWrap: { flex: 1 },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(24) },
  rowGap: { marginBottom: space(3) },
  sep: { height: space(3) },
});
