/**
 * Game detail + actions (M5 read-only → M7 actions). Join free (instant, server-truth
 * only — never optimistic §6.1) / paid (M6 checkout seam) / waitlist; leave with the
 * cutoff surfaced; organizer attendance. Renders free AND paid games, every state.
 */
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { DateBadge, ErrorState, HeroNav, ParallaxHero, Screen, Sheet, StickyCTA, useToast } from "@/components/chrome";
import { CheckoutSheet } from "@/components/checkout";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  ChevronRightIcon,
  ClockIcon,
  ExpandCard,
  MapPinIcon,
  Press,
  Skeleton,
  SlotBar,
  TierBadge,
} from "@/components/ds";
import { useCancelGame, useCompleteGame, useGame, useGameAction } from "@/hooks/queries";
import { useCheckout } from "@/hooks/useCheckout";
import { useIsOnline } from "@/hooks/useIsOnline";
import { usePush } from "@/hooks/usePush";
import { formatAmount, formatPrice, formatSessionWhen } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { shareEntity } from "@/lib/share";
import { color, layout, radius, space, type } from "@/lib/tokens";

/** Meta tile: a red-tinted rounded icon square with a bold value over a dim sub-line.
 *  When `onPress` is set it becomes a row action (e.g. venue → directions) with a chevron. */
function MetaTile({ icon, label, sub, onPress }: { icon: React.ReactNode; label: string; sub?: string; onPress?: () => void }) {
  const content = (
    <>
      <View style={styles.metaIcon}>{icon}</View>
      <View style={styles.metaText}>
        <Text style={styles.metaLabel} numberOfLines={1}>
          {label}
        </Text>
        {!!sub && <Text style={styles.metaSub}>{sub}</Text>}
      </View>
      {!!onPress && <ChevronRightIcon size={16} color={color.dim2} />}
    </>
  );
  return onPress ? (
    <Press accessibilityRole="button" accessibilityLabel={sub ? `${label}. ${sub}` : label} onPress={onPress} style={styles.meta}>
      {content}
    </Press>
  ) : (
    <View style={styles.meta}>{content}</View>
  );
}

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: game, isLoading, isError, error, refetch } = useGame(id);
  const action = useGameAction(id);
  const cancelGame = useCancelGame(id);
  const completeGame = useCompleteGame(id);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Staged attendance (userId → showed up). Unmarked means absent, and every player is sent
  // explicitly on submit so nobody is left sitting at whatever default the DB holds.
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const paid = !!game && game.pricePaise !== null && game.pricePaise > 0;
  const checkout = useCheckout("game", id);
  const online = useIsOnline();
  const { promptForPush } = usePush();
  const { show } = useToast();

  // Payment verification must not be swiped away mid-flight (DS §7).
  const sheetDismissible = checkout.state !== "processing" && checkout.state !== "reconciling";
  const closeSheet = () => {
    setSheetOpen(false);
    checkout.reset();
  };

  /**
   * Host-only cancel. The server permits it ONLY while nobody has joined; once players are
   * committed it 403s and unwinding becomes an admin matter. We check the same condition first so
   * the host gets the real explanation rather than a bare error.
   */
  const confirmCancel = () => {
    if (!game) return;
    if (game.slotsFilled > 0) {
      haptics.warning();
      show({
        title: "Can’t cancel now",
        body: "Players have already joined. Contact support and we’ll sort it out.",
      });
      return;
    }
    Alert.alert("Cancel this game?", "It’s removed from the feed and the venue slot is freed. This can’t be undone.", [
      { text: "Keep game", style: "cancel" },
      {
        text: "Cancel game",
        style: "destructive",
        onPress: () =>
          cancelGame.mutate(undefined, {
            onSuccess: () => {
              haptics.success();
              show({ title: "Game cancelled", body: "The slot is free for someone else." });
              router.back();
            },
            onError: (e: unknown) => show({ title: "Couldn’t cancel", body: (e as Error).message }),
          }),
      },
    ]);
  };

  const presentCount = game ? game.players.filter((p) => attendance[p.id]).length : 0;
  // Clock read on focus, not during render (react-hooks/purity) — same pattern as the Home greeting.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));
  // The server only checks status, so nothing stops it completing a game that hasn't happened —
  // irreversibly. Gate on kick-off having passed so a mistap can't close out next week's game.
  const hasStarted = !!game && new Date(game.startsAt).getTime() <= now;

  /**
   * Close out the game. One call marks it completed AND submits attendance, and it cannot be
   * repeated — so the confirmation spells out both the finality and the head-count being sent.
   */
  const confirmComplete = () => {
    if (!game) return;
    const absent = game.players.length - presentCount;
    Alert.alert(
      "Complete this game?",
      `${presentCount} present, ${absent} absent. This closes the game and can’t be undone.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Complete",
          style: "destructive",
          onPress: () => {
            // Send an entry for every player — omitting someone leaves their flag untouched.
            const map = Object.fromEntries(game.players.map((p) => [p.id, !!attendance[p.id]]));
            completeGame.mutate(map, {
              onSuccess: () => {
                haptics.success();
                show({
                  title: "Game completed",
                  body: "Attendance recorded. Points are awarded after review.",
                });
              },
              onError: (e: unknown) =>
                show({ title: "Couldn’t complete", body: (e as Error).message }),
            });
          },
        },
      ],
    );
  };

  const openDirections = () => {
    if (!game) return;
    const q = encodeURIComponent(game.venueAddress || game.venueName || game.title);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  // The money-in-limbo state's escape hatch: reach a human with the reference prefilled.
  const onSupport = () => {
    const subject = encodeURIComponent(`Payment help — game ${id}`);
    Linking.openURL(`mailto:support@gameground.net?subject=${subject}`).catch(() => {});
  };

  // A paid join confirming is a "first booking" moment — offer reminders (shown once).
  useEffect(() => {
    if (checkout.state === "success") promptForPush();
  }, [checkout.state, promptForPush]);

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this game."} onRetry={refetch} />
      </Screen>
    );
  }

  const price = game ? formatPrice(game.pricePaise) : null;
  const full = !!game && game.slotsFilled >= game.slotsTotal;

  const runFreeJoin = () => {
    action.mutate("join", {
      onSuccess: (result) => {
        // The last slot can go while the request is in flight — the server waitlists rather than
        // failing, so say so instead of silently reporting a join that didn't happen.
        if (result.kind === "waitlisted") {
          haptics.warning();
          show({
            title: "Added to the waitlist",
            body: `The last spot went — you’re #${result.position} in line.`,
          });
          return;
        }
        haptics.success(); // join-success feedback (full burst is M14)
        promptForPush(); // first successful join → offer reminders (§10.2)
      },
      // Errors surface through the app's own Toast, not a native OS alert (consistent feedback language).
      onError: (e) => show({ title: "Couldn’t join", body: (e as Error).message }),
    });
  };

  const confirmLeave = () => {
    if (!game) return;
    // Mirrors the server's 90-minute cutoff so we explain the block instead of firing a certain 403.
    if (game.leaveDeadlinePassed) {
      haptics.warning();
      show({
        title: "Too late to leave",
        body: "Spots can’t be given up within 90 minutes of kick-off.",
      });
      return;
    }
    // Destructive confirmation stays a native alert — HIG/Material both prefer it for irreversible actions.
    Alert.alert("Leave this game?", "Your spot opens up for the waitlist.", [
      { text: "Stay", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: () =>
          action.mutate("leave", {
            onSuccess: () => haptics.selection(),
            onError: (e) => show({ title: "Couldn’t leave", body: (e as Error).message }),
          }),
      },
    ]);
  };

  const joined = !!game?.viewerJoined;
  const waitlisted = !!game?.viewerWaitlisted;
  const isOrganizer = !!game?.viewerIsOrganizer;
  // Anyone with a settled relationship to this game — no price block, no loud primary.
  const confirmed = joined || waitlisted || isOrganizer;

  const onCtaPress = () => {
    if (!game) return;
    // The host can't join their own game; the useful action here is bringing players in.
    if (isOrganizer) return shareEntity("game", game.id, game.title);
    if (joined) return confirmLeave();
    if (waitlisted) return action.mutate("leave");
    if (full)
      return action.mutate("waitlist", {
        onSuccess: (result) => {
          haptics.selection();
          if (result.kind === "waitlisted") {
            show({ title: "You’re on the waitlist", body: `You’re #${result.position} in line.` });
          }
        },
        onError: (e) => show({ title: "Couldn’t join the waitlist", body: (e as Error).message }),
      });
    if (paid) return setSheetOpen(true);
    return runFreeJoin();
  };

  const ctaLabel = !game
    ? "…"
    : isOrganizer
      ? "Share game"
      : joined
        ? "Leave game"
        : waitlisted
          ? "Leave waitlist"
          : full
            ? "Join waitlist"
            : paid
              ? `Pay ${price}`
              : "Join game";

  // Joined/waitlisted: a calm confirmed status + a *secondary* leave, never a loud red primary.
  const ctaStatus = isOrganizer
    ? "You’re hosting"
    : joined
      ? "You’re in"
      : waitlisted
        ? "On the waitlist"
        : undefined;
  const stickyCaption =
    !online && !isOrganizer
      ? "Offline — reconnect to join"
      : paid && !confirmed
        ? "per player"
        : undefined;

  return (
    <Screen padded={false}>
      <HeroNav
        onBack={router.back}
        onShare={() => game && shareEntity("game", game.id, game.title)}
        scrollY={scrollY}
        title={game?.title}
        collapseAt={170}
      />
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ParallaxHero
          imageUrl={game?.imageUrl}
          height={HERO_H}
          scrollY={scrollY}
          topRight={game ? <DateBadge iso={game.startsAt} /> : undefined}
        >
          {game && (
            <View style={styles.heroOverlay}>
              <View style={styles.heroBadges}>
                {!!game.sport && <Badge label={game.sport} tone="red" />}
                {!!game.skillLevel && <Badge label={game.skillLevel} />}
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {game.title}
              </Text>
            </View>
          )}
        </ParallaxHero>

        <View style={styles.body}>
          {isLoading || !game ? (
            <>
              <View style={styles.metaList}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.meta}>
                    <Skeleton width={40} height={40} round={radius.tile} />
                    <View style={styles.metaText}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="35%" height={11} style={styles.gapSm} />
                    </View>
                  </View>
                ))}
              </View>
              <Skeleton width="100%" height={5} round={999} style={styles.gap} />
            </>
          ) : (
            <>
              <View style={styles.metaList}>
                <MetaTile
                  icon={<MapPinIcon size={17} color={color.redLight} />}
                  label={game.venueName || game.venueAddress || "Venue TBD"}
                  sub="Get directions"
                  onPress={game.venueName || game.venueAddress ? openDirections : undefined}
                />
                <MetaTile
                  icon={<ClockIcon size={17} color={color.redLight} />}
                  label={formatSessionWhen(game.startsAt)}
                  sub={game.durationMin ? `${game.durationMin} minutes` : undefined}
                />
              </View>

              <View style={styles.slot}>
                {/* Faces of who's in — social proof lives on the detail, where the join decision is made. */}
                {game.players.length > 0 && (
                  <View style={styles.playersRow}>
                    <AvatarStack people={game.players.map((p) => ({ name: p.name, uri: p.avatarUrl }))} />
                    <Text style={styles.playersJoined}>{game.slotsFilled} joined</Text>
                  </View>
                )}
                <SlotBar joined={game.slotsFilled} total={game.slotsTotal} hideCaption />
                <View style={styles.slotCaption}>
                  <Text style={styles.slotCapText}>
                    {Math.max(0, game.slotsTotal - game.slotsFilled)} slots left
                  </Text>
                  <Text style={styles.slotCapText}>
                    {game.slotsTotal > 0 ? Math.round((game.slotsFilled / game.slotsTotal) * 100) : 0}% full
                  </Text>
                </View>
              </View>

              {!!game.description && (
                <View style={styles.section}>
                  <Text style={styles.label}>About</Text>
                  <Text style={styles.description}>{game.description}</Text>
                </View>
              )}

              {/* Organizer attendance (§7). Staged locally, then submitted once with the
                  completion — the server takes the whole map in a single irreversible call. */}
              {isOrganizer && game.players.length > 0 && game.status !== "completed" && game.status !== "cancelled" && (
                <View style={styles.attendance}>
                  <Text style={styles.label}>Attendance</Text>
                  {game.players.map((p) => (
                    <AttendanceRow
                      key={p.id}
                      player={p}
                      present={!!attendance[p.id]}
                      onToggle={() => {
                        haptics.selection();
                        setAttendance((a) => ({ ...a, [p.id]: !a[p.id] }));
                      }}
                    />
                  ))}
                  {hasStarted ? (
                    <>
                      <Text style={styles.attHint}>
                        {presentCount} of {game.players.length} marked present. Completing is final.
                      </Text>
                      <Button
                        title={completeGame.isPending ? "Completing…" : "Complete game"}
                        variant="secondary"
                        onPress={confirmComplete}
                        loading={completeGame.isPending}
                      />
                    </>
                  ) : (
                    <Text style={styles.attHint}>
                      You can complete this game and submit attendance once it has started.
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.organizer}>
                <Text style={styles.label}>Organizer</Text>
                <Press
                  accessibilityRole="button"
                  accessibilityLabel={`View ${game.organizer.name}’s profile`}
                  onPress={() => router.push(`/profile?userId=${game.organizer.id}`)}
                  style={styles.orgRow}
                >
                  <Avatar name={game.organizer.name} uri={game.organizer.avatarUrl} size={44} />
                  <View style={styles.orgInfo}>
                    <Text style={styles.orgName}>{game.organizer.name}</Text>
                    <Text style={styles.orgSub}>Host</Text>
                  </View>
                  {game.organizerTier && <TierBadge tier={game.organizerTier} suffix="host" />}
                  <ChevronRightIcon size={16} color={color.dim2} />
                </Press>
              </View>

              {/* Host-only: cancel while the game is still callable off (§7). Hidden once it's
                  cancelled or played out — the server refuses both. */}
              {isOrganizer && game.status !== "completed" && game.status !== "cancelled" && (
                <View style={styles.hostActions}>
                  <Press
                    accessibilityRole="button"
                    accessibilityLabel="Cancel this game"
                    onPress={confirmCancel}
                    style={styles.cancelRow}
                  >
                    <Text style={styles.cancelText}>
                      {cancelGame.isPending ? "Cancelling…" : "Cancel this game"}
                    </Text>
                  </Press>
                </View>
              )}

              {/* Good to know (§5 ExpandCard) — rules and refund policy, collapsed by default. */}
              <View style={styles.goodToKnow}>
                <Text style={styles.label}>Good to know</Text>
                <ExpandCard
                  title="Rules & etiquette"
                  body="Arrive 10 minutes early · Non-marking shoes only · Attendance counts toward your tier · Spots can’t be given up within 90 minutes of kick-off."
                />
                <ExpandCard
                  title="Refunds & cancellation"
                  body="Full refund if the organizer cancels. Player cancellations follow the cutoff shown at checkout."
                />
              </View>
            </>
          )}
        </View>
      </Animated.ScrollView>

      {game && !sheetOpen && (
        <StickyCTA
          price={confirmed ? undefined : price}
          caption={stickyCaption}
          status={ctaStatus}
          ctaLabel={ctaLabel}
          buttonVariant={confirmed ? "secondary" : "primary"}
          onPress={onCtaPress}
          loading={action.isPending}
          // Sharing works offline; joining doesn't.
          disabled={!online && !isOrganizer}
        />
      )}

      {paid && (
        <Sheet visible={sheetOpen} dismissible={sheetDismissible} onDismiss={closeSheet}>
          <CheckoutSheet
            state={checkout.state}
            phase={checkout.phase}
            error={checkout.error}
            amount={game ? formatAmount(game.pricePaise as number) : ""}
            onPay={checkout.start}
            onRetry={checkout.retry}
            onSupport={onSupport}
            onClose={closeSheet}
          />
        </Sheet>
      )}
    </Screen>
  );
}

/**
 * Controlled row — the parent owns the staged map, because the server takes attendance as one
 * batch alongside the completion. Local staging is correct here; there is nothing to save per tap.
 */
function AttendanceRow({
  player,
  present,
  onToggle,
}: {
  player: { id: string; name: string; avatarUrl: string | null };
  present: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.attRow}>
      <Avatar name={player.name} uri={player.avatarUrl} size={32} />
      <Text style={styles.attName}>{player.name}</Text>
      <Press
        accessibilityRole="button"
        accessibilityState={{ selected: present }}
        accessibilityLabel={`Mark ${player.name} ${present ? "absent" : "present"}`}
        onPress={onToggle}
        style={[styles.attToggle, present && styles.attToggleOn]}
      >
        <Text style={[styles.attToggleText, present && styles.attToggleTextOn]}>{present ? "Present" : "Mark"}</Text>
      </Press>
    </View>
  );
}

const HERO_H = 260;

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(28) },
  body: { paddingHorizontal: layout.screenX, marginTop: space(4), gap: space(2) },

  // hero overlay (badges + title pinned to the bottom of the image)
  heroOverlay: { paddingHorizontal: layout.screenX, paddingBottom: space(4), gap: space(2.5) },
  heroBadges: { flexDirection: "row", gap: space(1.5) },
  heroTitle: { ...type.title1, color: color.text },

  // icon-tile meta rows
  metaList: { gap: space(3) },
  meta: { flexDirection: "row", alignItems: "center", gap: space(3) },
  metaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.tile,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
    alignItems: "center",
    justifyContent: "center",
  },
  metaText: { flex: 1, gap: space(0.5) },
  metaLabel: { ...type.bodyStrong, color: color.text, flexShrink: 1 },
  metaSub: { ...type.caption, color: color.dim },

  slot: { marginTop: space(4) },
  playersRow: { flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2.5) },
  playersJoined: { ...type.caption, color: color.dim },
  slotCaption: { flexDirection: "row", justifyContent: "space-between", marginTop: space(2) },
  slotCapText: { ...type.caption, color: color.dim },
  section: { marginTop: space(5), gap: space(2) },
  description: { ...type.body, color: color.dim, lineHeight: 20 },
  attendance: { marginTop: space(5), gap: space(2) },
  attHint: { ...type.caption, color: color.dim, marginTop: space(1) },
  attRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  attName: { ...type.body, color: color.text, flex: 1 },
  attToggle: { borderRadius: 999, borderWidth: 1, borderColor: color.border2, paddingVertical: space(1.5), paddingHorizontal: space(3) },
  attToggleOn: { backgroundColor: color.successSurface, borderColor: color.success },
  attToggleText: { ...type.caption, color: color.dim },
  attToggleTextOn: { color: color.success },
  organizer: { marginTop: space(5), gap: space(2) },
  orgRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  orgInfo: { flex: 1, gap: space(0.5) },
  orgSub: { ...type.caption, color: color.dim },
  hostActions: { marginTop: space(5) },
  cancelRow: {
    borderWidth: 1,
    borderColor: color.border2,
    borderRadius: radius.input,
    paddingVertical: space(3.5),
    alignItems: "center",
  },
  cancelText: { ...type.bodyStrong, color: color.redLight },

  goodToKnow: { marginTop: space(5), gap: space(2) },
  label: { ...type.label, color: color.dim },
  orgName: { ...type.heading, color: color.text },
  gap: { marginTop: space(3) },
  gapSm: { marginTop: space(1.5) },
});
