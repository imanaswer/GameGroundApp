/**
 * Home — the launch tab (product PRD 6.10). v1 composes a real feed client-side from the live
 * `/games` + `/coaches` endpoints (see useHome): greeting, the UpNext flagship hero, a "starting
 * soon" rail, a coaches rail, and a "set your sports" setup card. Every state ships (DS §9).
 *
 * The full server-composed feed (live ticker, ranked hero) lands when `GET /api/home` ships;
 * this screen is the shippable client-half until then.
 */
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { CoachCard, GameCard, UpNextHeroCard } from "@/components/cards";
import { EmptyState, Header, OfflineBanner, Screen } from "@/components/chrome";
import { Appear, CardSkeleton, ChevronRightIcon, GamesIcon, InfoIcon, Press, SearchIcon } from "@/components/ds";
import { toCoachCard, toGameCard, toUpNext, useHome, useProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, radius, space, type } from "@/lib/tokens";

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "there";
}

export default function HomeTab() {
  const router = useRouter();
  const { user } = useAuth();
  const home = useHome();
  const profile = useProfile(user?.id ?? "");
  const needsSports = profile.data && profile.data.sports.length === 0;

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const empty =
    !home.isLoading && !home.upNext && home.startingSoon.length === 0 && home.newCoaches.length === 0;

  return (
    <Screen padded={false}>
      <Header
        title="Game Ground"
        wordmark
        actions={[
          { key: "search", label: "Search", icon: <SearchIcon color={color.text} />, onPress: () => router.push("/search") },
        ]}
        me={user ? { name: user.name, uri: user.avatarUrl, onPress: () => router.push("/profile") } : undefined}
      />
      {home.isOffline && <OfflineBanner />}

      <AnimatedScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => {
              haptics.refresh();
              home.refetch();
            }}
            tintColor={color.dim}
          />
        }
      >
        <Appear index={0}>
          <Text style={styles.greeting}>
            {greeting(new Date())}, {firstName(user?.name)}
          </Text>
        </Appear>

        {needsSports && (
          <Appear index={1}>
            <Press onPress={() => router.push("/profile/edit")} style={styles.setupCard}>
              <View style={styles.setupIcon}>
                <InfoIcon color={color.redLight} />
              </View>
              <View style={styles.setupText}>
                <Text style={styles.setupTitle}>Set your sports</Text>
                <Text style={styles.setupBody}>Pick the sports you play to personalise your games.</Text>
              </View>
              <ChevronRightIcon color={color.dim2} />
            </Press>
          </Appear>
        )}

        {home.isLoading ? (
          <View style={styles.loading}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : empty ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<GamesIcon size={iconSize.empty} color={color.red} />}
              headline="No games tonight — yet."
              body="Be the first to start one."
              cta={{ label: "Create a game", onPress: () => router.push("/game/create") }}
            />
          </View>
        ) : (
          <>
            {home.upNext && (
              <Appear index={2}>
                <View style={styles.heroWrap}>
                  <UpNextHeroCard
                    data={toUpNext(home.upNext)}
                    scrollY={scrollY}
                    onPress={() => router.push(`/game/${home.upNext!.id}`)}
                  />
                </View>
              </Appear>
            )}

            {home.startingSoon.length > 0 && (
              <Appear index={3}>
                <Section label="Starting soon" onSeeAll={() => router.push("/games")}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {home.startingSoon.map((g) => (
                      <GameCard key={g.id} data={toGameCard(g)} compact onPress={() => router.push(`/game/${g.id}`)} />
                    ))}
                  </ScrollView>
                </Section>
              </Appear>
            )}

            {home.newCoaches.length > 0 && (
              <Appear index={4}>
                <Section label="Coaches to learn from" onSeeAll={() => router.push("/coaches")}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {home.newCoaches.map((c) => (
                      <View key={c.id} style={styles.railItem}>
                        <CoachCard data={toCoachCard(c)} onPress={() => router.push(`/coach/${c.id}`)} />
                      </View>
                    ))}
                  </ScrollView>
                </Section>
              </Appear>
            )}
          </>
        )}
      </AnimatedScrollView>
    </Screen>
  );
}

function Section({
  label,
  onSeeAll,
  children,
}: {
  label: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {onSeeAll && (
          <Press onPress={onSeeAll} style={styles.seeAll}>
            <Text style={styles.seeAllText}>See all</Text>
            <ChevronRightIcon size={14} color={color.redLight} />
          </Press>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(28) },
  greeting: { ...type.title1, color: color.text, paddingHorizontal: layout.screenX, marginTop: space(1), marginBottom: space(4) },

  setupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: space(3),
    backgroundColor: color.infoSurface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    padding: space(3.5),
    marginHorizontal: layout.screenX,
    marginBottom: space(5),
  },
  setupIcon: { width: 34, height: 34, borderRadius: 999, backgroundColor: color.redSurface, alignItems: "center", justifyContent: "center" },
  setupText: { flex: 1, gap: space(0.5) },
  setupTitle: { ...type.heading, color: color.text },
  setupBody: { ...type.caption, color: color.dim },

  loading: { paddingHorizontal: layout.screenX, gap: space(3) },
  emptyWrap: { height: 360 },
  heroWrap: { paddingHorizontal: layout.screenX, marginBottom: space(2) },

  section: { marginBottom: space(6) },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.screenX, marginBottom: space(3) },
  sectionLabel: { ...type.label, color: color.dim },
  seeAll: { flexDirection: "row", alignItems: "center", gap: space(0.5) },
  seeAllText: { ...type.caption, color: color.redLight, fontFamily: type.bodyStrong.fontFamily },

  rail: { paddingHorizontal: layout.screenX, gap: space(3) },
  railItem: { width: 260 },
});
