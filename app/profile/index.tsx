/**
 * Profile (M11). Own profile (from useAuth) or another user via ?userId (leaderboard links).
 * Hero + StatStrip + Overview/Games tabs (Achievements deferred to v1.1, Decision 6).
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState, HeroNav, Screen, SegmentedControl } from "@/components/chrome";
import { Button, SettingsIcon, Skeleton } from "@/components/ds";
import { PlayerHeroCard, StatStrip, WeekStrip } from "@/components/social/Profile";
import { useActivity, useProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { formatWhen } from "@/lib/format";
import { color, layout, space, type } from "@/lib/tokens";

type Tab = "overview" | "games";

export default function Profile() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const id = params.userId ?? user?.id ?? "";
  const isSelf = !params.userId || params.userId === user?.id;

  const { data: profile, isLoading, isError, error, refetch } = useProfile(id);
  const activity = useActivity(id);
  const [tab, setTab] = useState<Tab>("overview");

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this profile."} onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.nav}>
        {!isSelf && <HeroNav onBack={router.back} />}
        {isSelf && (
          <View style={styles.selfNav}>
            <Button
              title="Settings"
              variant="ghost"
              icon={<SettingsIcon color={color.dim} />}
              onPress={() => router.push("/profile/settings")}
            />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading || !profile ? (
          <>
            <Skeleton height={180} round={24} />
            <Skeleton height={64} style={styles.gap} />
          </>
        ) : (
          <>
            <PlayerHeroCard profile={profile} isSelf={isSelf} />
            <StatStrip stats={profile.stats} />
            {profile.seasonStrip.length > 0 && (
              <View style={styles.season}>
                <Text style={styles.label}>Recent attendance</Text>
                <WeekStrip data={profile.seasonStrip} />
              </View>
            )}

            {isSelf && <Button title="Edit profile" variant="secondary" onPress={() => router.push("/profile/edit")} />}

            <SegmentedControl
              segments={[
                { key: "overview", label: "Overview" },
                { key: "games", label: "Games" },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === "overview" && (
              <View style={styles.section}>
                {activity.isLoading ? (
                  <Skeleton height={16} width="80%" />
                ) : (activity.data?.length ?? 0) === 0 ? (
                  <Text style={styles.muted}>No activity yet.</Text>
                ) : (
                  activity.data!.map((a) => (
                    <View key={a.id} style={styles.activityRow}>
                      <View style={styles.dot} />
                      <View style={styles.activityText}>
                        <Text style={styles.activityTitle}>{a.title}</Text>
                        <Text style={styles.activityAt}>{formatWhen(a.at)}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {tab === "games" && (
              <View style={styles.section}>
                <Text style={styles.muted}>Games history appears here.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: space(6) },
  selfNav: { alignItems: "flex-end", paddingHorizontal: space(2), paddingTop: space(2) },
  scroll: { paddingHorizontal: layout.screenX, paddingBottom: space(20), gap: space(4) },
  gap: { marginTop: space(3) },
  season: { gap: space(2) },
  label: { ...type.label, color: color.dim },
  section: { gap: space(3) },
  muted: { ...type.body, color: color.dim },
  activityRow: { flexDirection: "row", gap: space(3), alignItems: "flex-start" },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: color.red, marginTop: space(1.5) },
  activityText: { flex: 1, gap: space(0.5) },
  activityTitle: { ...type.body, color: color.text },
  activityAt: { ...type.caption, color: color.dim },
});
