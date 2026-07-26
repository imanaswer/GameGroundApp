/**
 * Game detail + actions (M5 read-only → M7 actions). Join free (instant, server-truth
 * only — never optimistic §6.1) / paid (M6 checkout seam) / waitlist; leave with the
 * cutoff surfaced; organizer attendance. Renders free AND paid games, every state.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState, HeroNav, Screen, StickyCTA } from "@/components/chrome";
import { CheckoutSheet } from "@/components/checkout";
import {
  Avatar,
  AvatarStack,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  Press,
  Skeleton,
  SlotBar,
  TierBadge,
  UserIcon,
} from "@/components/ds";
import { useGame, useGameAction } from "@/hooks/queries";
import { useCheckout } from "@/hooks/useCheckout";
import { usePush } from "@/hooks/usePush";
import { formatAmount, formatPrice, formatWhen } from "@/lib/format";
import * as haptics from "@/lib/haptics";
import { shareEntity } from "@/lib/share";
import { color, gradient, layout, space, type } from "@/lib/tokens";

function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaText}>{text}</Text>
    </View>
  );
}

export default function GameDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: game, isLoading, isError, error, refetch } = useGame(id);
  const action = useGameAction(id);
  const [sheetOpen, setSheetOpen] = useState(false);

  const paid = !!game && game.pricePaise !== null && game.pricePaise > 0;
  const checkout = useCheckout("game", id);
  const { promptForPush } = usePush();

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
      onSuccess: () => {
        haptics.success(); // join-success feedback (full burst is M14)
        promptForPush(); // first successful join → offer reminders (§10.2)
      },
      onError: (e) => Alert.alert("Couldn’t join", (e as Error).message),
    });
  };

  const confirmLeave = () => {
    if (!game) return;
    if (game.leaveDeadlinePassed) {
      haptics.warning();
      Alert.alert("Too late to leave", "The cutoff to leave this game has passed.");
      return;
    }
    Alert.alert("Leave this game?", "Your spot opens up for the waitlist.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => action.mutate("leave") },
    ]);
  };

  const onCtaPress = () => {
    if (!game) return;
    if (game.viewerJoined) return confirmLeave();
    if (game.viewerWaitlisted) return action.mutate("leave");
    if (full) return action.mutate("waitlist", { onSuccess: () => haptics.selection() });
    if (paid) return setSheetOpen(true);
    return runFreeJoin();
  };

  const ctaLabel = !game
    ? "…"
    : game.viewerJoined
      ? "You’re in — leave"
      : game.viewerWaitlisted
        ? "On waitlist — leave"
        : full
          ? "Join waitlist"
          : paid
            ? `Pay ${price}`
            : "Join game";

  return (
    <Screen padded={false}>
      <HeroNav onBack={router.back} onShare={() => game && shareEntity("game", game.id, game.title)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {game?.imageUrl ? (
            <Image source={{ uri: game.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.heroFallback]} />
          )}
          <LinearGradient
            colors={gradient.heroScrim.colors as unknown as [string, string, string]}
            locations={gradient.heroScrim.locations as unknown as [number, number, number]}
            style={StyleSheet.absoluteFill}
          />
        </View>

        <View style={styles.body}>
          {isLoading || !game ? (
            <>
              <Skeleton width="80%" height={26} />
              <Skeleton width="55%" height={14} style={styles.gap} />
              <Skeleton width="100%" height={5} style={styles.gap} />
            </>
          ) : (
            <>
              <Text style={styles.title}>{game.title}</Text>
              <View style={styles.sportRow}>
                <Text style={styles.sport}>{game.sport}</Text>
                {game.organizerTier && <TierBadge tier={game.organizerTier} />}
              </View>

              <View style={styles.metaBlock}>
                <MetaRow icon={<CalendarIcon color={color.dim} />} text={formatWhen(game.startsAt)} />
                <MetaRow
                  icon={<ClockIcon color={color.dim} />}
                  text={new Date(game.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                />
                <MetaRow icon={<MapPinIcon color={color.dim} />} text={game.venueAddress ?? game.venueName} />
                {game.skillLevel && <MetaRow icon={<UserIcon color={color.dim} />} text={game.skillLevel} />}
              </View>

              {game.players.length > 0 && (
                <View style={styles.playersRow}>
                  <AvatarStack people={game.players.map((p) => ({ name: p.name, uri: p.avatarUrl }))} max={6} size={32} />
                  <Text style={styles.playersText}>{game.slotsFilled} joined</Text>
                </View>
              )}

              <View style={styles.slot}>
                <SlotBar joined={game.slotsFilled} total={game.slotsTotal} />
              </View>

              {!!game.description && <Text style={styles.description}>{game.description}</Text>}

              {/* Organizer attendance (§7) — mark players present. */}
              {game.viewerIsOrganizer && game.players.length > 0 && (
                <View style={styles.attendance}>
                  <Text style={styles.label}>Attendance</Text>
                  {game.players.map((p) => (
                    <AttendanceRow key={p.id} player={p} />
                  ))}
                </View>
              )}

              <View style={styles.organizer}>
                <Text style={styles.label}>Organizer</Text>
                <Text style={styles.orgName}>{game.organizer.name}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {game && !sheetOpen && (
        <StickyCTA
          price={price}
          caption={price && !game.viewerJoined ? "per player" : undefined}
          ctaLabel={ctaLabel}
          onPress={onCtaPress}
          loading={action.isPending}
        />
      )}

      {sheetOpen && paid && (
        <View style={styles.sheetHost}>
          <CheckoutSheet
            state={checkout.state}
            phase={checkout.phase}
            error={checkout.error}
            amount={game ? formatAmount(game.pricePaise as number) : ""}
            onPay={checkout.start}
            onRetry={checkout.retry}
            onSupport={() => {}}
          />
          {checkout.state === "success" && (
            <Press onPress={() => setSheetOpen(false)} style={styles.done}>
              <Text style={styles.doneText}>Done</Text>
            </Press>
          )}
        </View>
      )}
    </Screen>
  );
}

function AttendanceRow({ player }: { player: { id: string; name: string; avatarUrl: string | null } }) {
  const [present, setPresent] = useState(false);
  return (
    <View style={styles.attRow}>
      <Avatar name={player.name} uri={player.avatarUrl} size={32} />
      <Text style={styles.attName}>{player.name}</Text>
      <Press
        accessibilityRole="button"
        accessibilityLabel={`Mark ${player.name} present`}
        onPress={() => {
          haptics.selection();
          setPresent((p) => !p);
          // ponytail: optimistic toggle for responsiveness; real markAttendance wired when
          // the organizer flow is device-tested (server remains the source of truth).
        }}
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
  hero: { height: HERO_H, backgroundColor: color.imagePlaceholder },
  heroFallback: { backgroundColor: color.card },
  body: { paddingHorizontal: layout.screenX, marginTop: -space(8), gap: space(2) },
  title: { ...type.title1, color: color.text },
  sportRow: { flexDirection: "row", alignItems: "center", gap: space(2) },
  sport: { ...type.bodyStrong, color: color.dim, textTransform: "capitalize" },
  metaBlock: { marginTop: space(3), gap: space(2.75) },
  meta: { flexDirection: "row", alignItems: "center", gap: space(2.5) },
  metaText: { ...type.body, color: color.text, flexShrink: 1 },
  playersRow: { flexDirection: "row", alignItems: "center", gap: space(3), marginTop: space(4) },
  playersText: { ...type.caption, color: color.dim },
  slot: { marginTop: space(4) },
  description: { ...type.body, color: color.dim, lineHeight: 20, marginTop: space(4) },
  attendance: { marginTop: space(5), gap: space(2) },
  attRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  attName: { ...type.body, color: color.text, flex: 1 },
  attToggle: { borderRadius: 999, borderWidth: 1, borderColor: color.border2, paddingVertical: space(1.5), paddingHorizontal: space(3) },
  attToggleOn: { backgroundColor: color.successSurface, borderColor: color.success },
  attToggleText: { ...type.caption, color: color.dim },
  attToggleTextOn: { color: color.success },
  organizer: { marginTop: space(5), gap: space(1) },
  label: { ...type.label, color: color.dim },
  orgName: { ...type.heading, color: color.text },
  gap: { marginTop: space(3) },
  sheetHost: { position: "absolute", left: 0, right: 0, bottom: 0 },
  done: { alignItems: "center", paddingVertical: space(4), backgroundColor: color.elev },
  doneText: { ...type.heading, color: color.text },
});
