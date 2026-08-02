/**
 * Home — the launch tab (product PRD 6.10). v1 composes a real feed client-side from the live
 * `/games` + `/coaches` endpoints (see useHome): greeting, the UpNext flagship hero, a "starting
 * soon" rail, a coaches rail, and a dismissible "set your sports" setup card. Every state ships (DS §9).
 *
 * The full server-composed feed (live ticker, ranked hero) lands when `GET /api/home` ships;
 * this screen is the shippable client-half until then.
 */
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from "react-native-reanimated";

import { CoachCard, GameCard, UpNextHeroCard } from "@/components/cards";
import { EmptyState, Header, OfflineBanner, Screen, SetupCard, useTabBarPadding } from "@/components/chrome";
import { Appear, ChevronRightIcon, GamesIcon, InfoIcon, Press, SearchIcon, Skeleton } from "@/components/ds";
import type { GameSummary } from "@/api/types";
import { toCoachCard, toGameCard, toUpNext, useGamePlayers, useHome, useProfile } from "@/hooks/queries";
import { useAuth } from "@/hooks/useAuth";
import * as haptics from "@/lib/haptics";
import * as storage from "@/lib/storage";
import { color, font, icon as iconSize, layout, radius, space, type } from "@/lib/tokens";

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

  // Greeting recomputes on focus so a long-lived session doesn't stay "morning" into the evening.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => setNow(new Date()), []));

  // "Set your sports" is a dismissible-once nudge. null = flag still loading (render nothing yet).
  const [sportsDismissed, setSportsDismissed] = useState<boolean | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      storage.get("gg.setupSportsDismissed").then((v) => alive && setSportsDismissed(v ?? false));
      return () => {
        alive = false;
      };
    }, []),
  );
  const needsSports = !!profile.data && profile.data.sports.length === 0 && sportsDismissed === false;
  const dismissSports = () => {
    haptics.selection();
    setSportsDismissed(true);
    storage.set("gg.setupSportsDismissed", true);
  };

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const bottomPad = useTabBarPadding(space(6));

  const empty =
    !home.isLoading && !home.upNext && home.startingSoon.length === 0 && home.newCoaches.length === 0;

  // Entrance stagger indices are computed from what actually renders, so an absent setup card
  // doesn't leave the hero waiting on a skipped slot's delay (MOTION.md §2 stagger).
  const heroIndex = needsSports ? 2 : 1;

  return (
    <Screen padded={false}>
      <Header
        title="GameGround"
        wordmark
        actions={[
          { key: "search", label: "Search", icon: <SearchIcon color={color.text} />, onPress: () => router.push("/search") },
        ]}
        me={user ? { name: user.name, uri: user.avatarUrl, onPress: () => router.push("/profile") } : undefined}
      />
      {home.isOffline && <OfflineBanner />}

      <AnimatedScrollView
        contentContainerStyle={{ ...styles.scroll, paddingBottom: bottomPad }}
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
          <View style={styles.greetWrap}>
            <Text style={styles.greeting}>
              {greeting(now)},{" "}
              <Text style={styles.greetingName}>{firstName(user?.name)}</Text>
            </Text>
            {home.nearbyCount > 0 && (
              <Text style={styles.subtitle}>
                {home.nearbyCount} {home.nearbyCount === 1 ? "game" : "games"} tonight
              </Text>
            )}
          </View>
        </Appear>

        {needsSports && (
          <Appear index={1}>
            <SetupCard
              style={styles.setup}
              icon={<InfoIcon color={color.text} />}
              title="Set your sports"
              body="Pick the sports you play to personalise your games."
              onPress={() => router.push("/profile/edit")}
              onDismiss={dismissSports}
            />
          </Appear>
        )}

        {home.isLoading ? (
          <HomeSkeleton />
        ) : empty ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<GamesIcon size={iconSize.empty} color={color.red} />}
              headline="No open games yet"
              body="Be the first to start one — or browse everything happening on GameGround."
              cta={{ label: "Host a game", onPress: () => router.push("/game/create") }}
              secondary={{ label: "Browse all games", onPress: () => router.push("/games") }}
            />
          </View>
        ) : (
          <>
            {home.upNext && (
              <Appear index={heroIndex}>
                <View style={styles.heroWrap}>
                  {/* Label it for what it is: only call it "yours" when the viewer is actually in it. */}
                  <Text style={styles.heroLabel}>
                    {home.upNextIsMine ? "Up next for you" : "Happening soon"}
                  </Text>
                  <HeroCard game={home.upNext} scrollY={scrollY} onPress={() => router.push(`/game/${home.upNext!.id}`)} />
                </View>
              </Appear>
            )}

            {home.startingSoon.length > 0 && (
              <Appear index={heroIndex + 1}>
                <Section label="Starting soon" onSeeAll={() => router.push("/games")}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {home.startingSoon.map((g) => (
                      <RailGameCard key={g.id} game={g} onPress={() => router.push(`/game/${g.id}`)} />
                    ))}
                  </ScrollView>
                </Section>
              </Appear>
            )}

            {home.newCoaches.length > 0 && (
              <Appear index={heroIndex + 2}>
                <Section label="Coaches to learn from" onSeeAll={() => router.push("/coaches")}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {home.newCoaches.map((c) => (
                      <CoachCard key={c.id} data={toCoachCard(c)} compact onPress={() => router.push(`/coach/${c.id}`)} />
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

/**
 * The `/games` LIST route sends only a joined count — never player identities. Real faces live on
 * the detail route, so each card borrows the detail query (same key, so it warms the detail screen
 * too) and only when someone has actually joined. Without this the Home facepiles were always empty
 * while the Games tab showed real ones.
 */
function RailGameCard({ game, onPress }: { game: GameSummary; onPress: () => void }) {
  const { data: players } = useGamePlayers(game.id, game.slotsFilled > 0);
  return <GameCard data={toGameCard(game, players)} compact onPress={onPress} />;
}

function HeroCard({
  game,
  scrollY,
  onPress,
}: {
  game: GameSummary;
  scrollY: SharedValue<number>;
  onPress: () => void;
}) {
  const { data: players } = useGamePlayers(game.id, game.slotsFilled > 0);
  return <UpNextHeroCard data={toUpNext(game, players)} scrollY={scrollY} onPress={onPress} />;
}

/** Loading state, shaped like the real first paint (DS §4): a 176pt hero + one rail of cards. */
function HomeSkeleton() {
  return (
    <View style={styles.skeleton}>
      <View style={styles.heroWrap}>
        <Skeleton height={176} round={radius.card} />
      </View>
      <View>
        <View style={styles.sectionHead}>
          <Skeleton width={110} height={12} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} scrollEnabled={false} contentContainerStyle={styles.rail}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={210} height={158} round={radius.card} />
          ))}
        </ScrollView>
      </View>
    </View>
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
          <Press onPress={onSeeAll} hitSlop={8} style={styles.seeAll}>
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
  // flexGrow lets the empty state fill the viewport below the greeting instead of floating.
  scroll: { flexGrow: 1, paddingBottom: space(28) },
  greetWrap: { paddingHorizontal: layout.screenX, marginTop: space(1), marginBottom: space(4) },
  greeting: { ...type.title1, color: color.text },
  greetingName: { fontFamily: font.serif, fontStyle: "italic", fontSize: 24, color: color.redLight },
  subtitle: { ...type.body, color: color.dim, marginTop: space(1.5) },

  setup: { marginHorizontal: layout.screenX, marginBottom: space(5) },

  skeleton: { gap: space(6) },
  emptyWrap: { flex: 1 },
  heroWrap: { paddingHorizontal: layout.screenX, marginBottom: space(2) },
  heroLabel: { ...type.label, color: color.dim, marginBottom: space(2.5) },

  section: { marginBottom: space(6) },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.screenX, marginBottom: space(3) },
  sectionLabel: { ...type.label, color: color.dim },
  seeAll: { flexDirection: "row", alignItems: "center", gap: space(0.5) },
  // Demoted from the section label's uppercase treatment: an action shouldn't wear the title's clothes.
  seeAllText: { ...type.bodyStrong, fontSize: 12, color: color.redLight },

  rail: { paddingHorizontal: layout.screenX, gap: layout.railGap },
});
