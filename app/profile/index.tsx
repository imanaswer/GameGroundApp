/**
 * Profile (M11). Own profile is an account hub — hero + stat strip + a settings menu (Notifications,
 * Payments, Simulate tier-up, Log out). Viewing another user (?userId, from leaderboard links) shows
 * their hero + stats + games. Tapping your own hero opens Edit.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState, PageNav, Screen } from "@/components/chrome";
import { BellIcon, CardIcon, ChevronRightIcon, InfoIcon, LogOutIcon, MessageIcon, Press, Skeleton, StarIcon } from "@/components/ds";
import { ActivityFeed, PlayerHeroCard, StatStrip, UpcomingGames, WeekStrip } from "@/components/social/Profile";
import { useTierUp } from "@/components/social/TierUp";
import { useActivity, useProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import { color, layout, space, type } from "@/lib/tokens";

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const id = params.userId ?? user?.id ?? "";
  const isSelf = !params.userId || params.userId === user?.id;

  const { data: profile, isLoading, isError, error, refetch } = useProfile(id);
  const { data: activity } = useActivity(id);

  // "Upcoming" = games the user has joined/organized that are still ahead, soonest first. The
  // server owns status; we only filter to future, non-terminal games (never recompute anything).
  const now = new Date().getTime();
  const upcoming = (profile?.games ?? [])
    .filter((g) => g.status !== "completed" && g.status !== "cancelled" && new Date(g.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Real tier-up celebration (MOTION §5) — fires once when the viewer's own tier increases.
  const { celebrate, simulate } = useTierUp();
  useEffect(() => {
    if (isSelf && profile?.tier) celebrate(profile.tier);
  }, [isSelf, profile?.tier, celebrate]);

  if (isError) {
    return (
      <Screen>
        <PageNav title="Profile" onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this profile."} onRetry={refetch} />
      </Screen>
    );
  }

  const runSimulate = () => {
    if (!profile) return;
    simulate(profile.tier, {
      caption: `${profile.stats.games} games · ${profile.stats.attendance}% attendance · keep climbing`,
    });
  };

  const confirmLogout = () => {
    Alert.alert("Log out?", "You’ll need to log back in next time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => logout().then(() => router.replace("/login")) },
    ]);
  };

  return (
    <Screen padded={false}>
      <PageNav title="Profile" onBack={router.back} />

      <ScrollView contentContainerStyle={styles.scroll}>
        {isLoading || !profile ? (
          <>
            <Skeleton height={150} round={24} />
            <Skeleton height={64} style={styles.gap} />
          </>
        ) : (
          <>
            {isSelf ? (
              <Press
                accessibilityRole="button"
                accessibilityLabel="Edit profile"
                onPress={() => router.push("/profile/edit")}
              >
                <PlayerHeroCard profile={profile} isSelf />
              </Press>
            ) : (
              <PlayerHeroCard profile={profile} />
            )}

            <StatStrip stats={profile.stats} />

            {profile.seasonStrip.length > 0 && (
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Recent attendance</Text>
                <WeekStrip data={profile.seasonStrip} />
              </View>
            )}

            <UpcomingGames games={upcoming} onOpen={(gid) => router.push(`/game/${gid}`)} />

            <ActivityFeed items={activity ?? []} />

            {isSelf && (
              <View style={styles.menu}>
                <Text style={styles.menuHeader}>Settings</Text>
                <View>
                  <MenuRow
                    icon={<BellIcon color={color.dim} />}
                    label="Notifications"
                    onPress={() => router.push("/profile/settings")}
                  />
                  <MenuRow
                    icon={<CardIcon color={color.dim} />}
                    label="Payment history"
                    onPress={() => router.push("/profile/payments")}
                    divider
                  />
                  {/* Dev/QA affordance only — never exposed in a production build. */}
                  {__DEV__ && (
                    <MenuRow
                      icon={<StarIcon color={color.red} />}
                      label="Simulate tier-up"
                      onPress={runSimulate}
                      divider
                    />
                  )}
                  <MenuRow
                    icon={<MessageIcon color={color.dim} />}
                    label="Help & support"
                    onPress={() => Linking.openURL("mailto:support@gameground.net?subject=GameGround%20support")}
                    divider
                  />
                  <MenuRow
                    icon={<InfoIcon color={color.dim} />}
                    label="Privacy policy"
                    onPress={() => Linking.openURL("https://www.gameground.net/privacy")}
                    divider
                  />
                  <MenuRow
                    icon={<InfoIcon color={color.dim} />}
                    label="Terms of service"
                    onPress={() => Linking.openURL("https://www.gameground.net/terms")}
                    divider
                  />
                  <MenuRow
                    icon={<LogOutIcon color={color.redLight} />}
                    label="Log out"
                    danger
                    onPress={confirmLogout}
                    divider
                  />
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  danger,
  onPress,
  divider,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  danger?: boolean;
  onPress: () => void;
  divider?: boolean;
}) {
  return (
    <Press
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.menuRow, divider && styles.menuDivider]}
    >
      {icon}
      <Text style={[styles.menuLabel, danger && styles.menuDanger]}>
        {label}
        {hint ? <Text style={styles.menuHint}> {hint}</Text> : null}
      </Text>
      {!danger && <ChevronRightIcon size={16} color={color.dim2} />}
    </Press>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.screenX, paddingBottom: space(20), gap: space(4) },
  gap: { marginTop: space(3) },
  formSection: { gap: space(2.5) },
  formLabel: { ...type.label, color: color.dim },

  menu: { gap: space(2) },
  menuHeader: { ...type.label, color: color.dim, marginBottom: space(1) },
  menuRow: { flexDirection: "row", alignItems: "center", gap: space(3.5), paddingVertical: space(3.5) },
  menuDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  menuLabel: { ...type.body, color: color.text, flex: 1 },
  menuHint: { ...type.caption, color: color.dim2 },
  menuDanger: { color: color.redLight },
});
