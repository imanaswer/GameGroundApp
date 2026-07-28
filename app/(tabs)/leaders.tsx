/**
 * Leaderboard (M10). players/organizers + all-time/30d toggles, podium top-3, own-rank
 * pinned when outside the list. Filter changes keep previous rows (no full-screen spinner).
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import type { LeaderScope, LeaderWindow } from "@/api/types";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, SegmentedControl } from "@/components/chrome";
import { ChipRow, LeadersIcon, Skeleton } from "@/components/ds";
import { LeaderRow, PinnedRankRow, Podium } from "@/components/social/Leaderboard";
import { useLeaderboard } from "@/hooks/queries";
import { useIsOnline } from "@/hooks/useIsOnline";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

const SCOPES: { key: LeaderScope; label: string }[] = [
  { key: "players", label: "Players" },
  { key: "organizers", label: "Organizers" },
];
const WINDOWS = [
  { key: "all", label: "All-time" },
  { key: "30d", label: "Last 30 days" },
];

export default function LeadersTab() {
  const router = useRouter();
  const [scope, setScope] = useState<LeaderScope>("players");
  const [window, setWindow] = useState<LeaderWindow>("all");
  const { data, isLoading, isError, error, refetch } = useLeaderboard(scope, window);
  const online = useIsOnline();

  const goto = (id: string) => router.push(`/profile?userId=${id}`);
  const top3 = data?.rows.slice(0, 3) ?? [];
  const rest = data?.rows.slice(3) ?? [];
  // Pin own rank only when the viewer isn't already visible in the list.
  const pinned =
    data?.viewerRank && !data.rows.some((r) => r.user.id === data.viewerRank?.user.id)
      ? data.viewerRank
      : null;

  return (
    <Screen padded={false}>
      <Header title="Leaders" />
      {!online && <OfflineBanner />}
      <View style={styles.controls}>
        <SegmentedControl segments={SCOPES} value={scope} onChange={setScope} />
      </View>
      <View style={styles.controls}>
        <ChipRow items={WINDOWS} value={window} onChange={(k) => setWindow(k as LeaderWindow)} />
      </View>

      {isLoading && !data ? (
        <View style={styles.list}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={44} style={styles.skel} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load the leaderboard."} onRetry={refetch} />
      ) : data && data.rows.length === 0 ? (
        <EmptyState
          icon={<LeadersIcon size={iconSize.empty} color={color.red} />}
          headline="No rankings yet."
          body="Play some games to get on the board."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {top3.length > 0 && <Podium top={top3} onPress={goto} />}
          {rest.map((r, i) => (
            <LeaderRow key={r.user.id} row={r} onPress={goto} index={i} />
          ))}
        </ScrollView>
      )}

      {pinned && <PinnedRankRow row={pinned} onPress={goto} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: layout.screenX, paddingBottom: space(3) },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(6) },
  skel: { marginBottom: space(2) },
});
