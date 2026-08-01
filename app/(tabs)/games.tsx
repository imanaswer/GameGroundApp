/**
 * Games list (M5). FlashList feed with sport chips. Screen composes — data via useGames (§6.1).
 * Every state ships (DS §9). Text search lives in the header icon → /search modal.
 */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, StyleSheet, View } from "react-native";

import { GameCard } from "@/components/cards";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, useTabBarPadding } from "@/components/chrome";
import { Appear, Button, CardSkeleton, ChipRow, GamesIcon, PlusIcon, SearchIcon } from "@/components/ds";
import { toGameCard, useGamePlayers, useGames } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import type { GameSummary } from "@/api/types";
import { isToday } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

/** One feed card. Pulls the real joinee avatars from the detail cache when the game has players. */
function GameFeedCard({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  const { data: players } = useGamePlayers(game.id, game.slotsFilled > 0);
  return <GameCard data={toGameCard(game, players)} onPress={onPress} />;
}

// Keys are sent verbatim to the API's `sport` filter, which is case-sensitive — they MUST match the
// server's stored casing (e.g. "Football", not "football"), or the query returns nothing.
const SPORTS = [
  { key: "all", label: "All" },
  { key: "Football", label: "Football" },
  { key: "Cricket", label: "Cricket" },
  { key: "Badminton", label: "Badminton" },
  { key: "Basketball", label: "Basketball" },
  { key: "Tennis", label: "Tennis" },
];

export default function GamesTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [sport, setSport] = useState("all");

  const { data, isLoading, isError, error, refetch, isRefetching, isPaused } = useGames({
    sport,
    status: "open",
  });

  const empty = data && data.length === 0;
  // Subtitle counts games happening TODAY (not the total open list), per the mock copy.
  const liveToday = (data ?? []).filter((g) => isToday(g.startsAt)).length;
  // Neutral line while loading or empty — never a negative "0 … live today" over an empty state.
  const subtitle = isLoading || empty
    ? "Pickup games near you"
    : isError
      ? undefined
      : `${liveToday} pickup game${liveToday === 1 ? "" : "s"} live today`;
  const bottomPad = useTabBarPadding();
  // The host FAB floats just above the tab bar; the feed pads extra so the last card clears it.
  const fabBottom = useTabBarPadding(space(3));
  const showFab = !isError && !empty;
  // Carry the active sport filter into create, so "Host a game" from a filtered/empty list pre-selects it.
  const hostGame = () =>
    router.push(sport === "all" ? "/game/create" : { pathname: "/game/create", params: { sport } });

  return (
    <Screen padded={false}>
      <Header
        title="Games"
        subtitle={subtitle}
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
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load games."} onRetry={refetch} />
      ) : empty ? (
        <EmptyState
          icon={<GamesIcon size={iconSize.empty} color={color.red} />}
          headline={sport === "all" ? "No games tonight — yet." : `No ${sport} games — yet.`}
          body="Someone has to go first. Why not you?"
          cta={{ label: "Host a game", onPress: hostGame }}
        />
      ) : (
        // Keyed on the active sport so a filter change re-runs the entrance (MOTION §2), while
        // in-place refetches (pull-to-refresh) do not.
        <Appear key={sport} style={styles.listWrap}>
          <FlashList
            data={data}
            keyExtractor={(g) => g.id}
            contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad + space(14) }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <GameFeedCard game={item} onPress={() => router.push(`/game/${item.id}`)} />
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

      {showFab && (
        <Button
          title="Host a game"
          icon={<PlusIcon size={iconSize.meta} color={color.text} />}
          onPress={hostGame}
          style={[styles.fab, { bottom: fabBottom }]}
        />
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
  fab: { position: "absolute", right: layout.screenX, borderRadius: 999, paddingHorizontal: space(5) },
});
