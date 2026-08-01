/**
 * Leaderboard (M10). players/organizers + all-time/30d toggles, podium top-3, own-rank
 * pinned when outside the list. Filter changes keep previous rows (no full-screen spinner).
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { LeaderScope, LeaderWindow } from "@/api/types";
import { EmptyState, ErrorState, Header, OfflineBanner, Screen, useTabBarPadding } from "@/components/chrome";
import { Chip, LeadersIcon, Press, Skeleton } from "@/components/ds";
import { LeaderRow, PinnedRankRow, Podium } from "@/components/social/Leaderboard";
import { useLeaderboard } from "@/hooks/queries";
import { useIsOnline } from "@/hooks/useIsOnline";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space, type } from "@/lib/tokens";

const SCOPES: { key: LeaderScope; label: string }[] = [
  { key: "players", label: "Players" },
  { key: "organizers", label: "Organizers" },
];
const WINDOWS: { key: LeaderWindow; label: string }[] = [
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
  // Clear the absolute tab bar, plus the pinned own-rank strip when it's floating above it.
  const bottomPad = useTabBarPadding(pinned ? space(20) : space(4));

  return (
    <Screen padded={false}>
      <Header title="Leaders" />
      {!online && <OfflineBanner />}
      <View style={styles.controls}>
        <View style={styles.scopeTabs}>
          {SCOPES.map((s) => {
            const on = scope === s.key;
            return (
              <Press
                key={s.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => {
                  haptics.selection();
                  setScope(s.key);
                }}
                style={styles.tab}
              >
                <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{s.label}</Text>
                <View style={[styles.underline, on && styles.underlineOn]} />
              </Press>
            );
          })}
        </View>
        <View style={styles.windowChips}>
          {WINDOWS.map((w) => (
            <Chip key={w.key} label={w.label} active={window === w.key} onPress={() => setWindow(w.key)} size="sm" />
          ))}
        </View>
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
          cta={{ label: "Find a game", onPress: () => router.push("/games") }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}>
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.screenX,
    paddingBottom: space(3),
  },
  scopeTabs: { flexDirection: "row", gap: space(5) },
  tab: { alignItems: "center", gap: space(1.5), paddingTop: space(1) },
  tabLabel: { ...type.heading, color: color.dim },
  tabLabelOn: { color: color.text },
  underline: { height: 2.5, width: "100%", borderRadius: 999 },
  underlineOn: { backgroundColor: color.red },
  windowChips: { flexDirection: "row", gap: space(2) },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(6) },
  skel: { marginBottom: space(2) },
});
