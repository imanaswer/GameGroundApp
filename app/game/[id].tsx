/**
 * Game detail (M5, read-only). Hero + meta rows + joined-player stack + SlotBar +
 * organizer TierBadge. StickyCTA is present but INERT — join/pay is M6/M7 (§ StickyCTA
 * success-morph only after server truth). Renders every field for free AND paid games.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState, HeroNav, Screen, StickyCTA } from "@/components/chrome";
import {
  AvatarStack,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  Skeleton,
  SlotBar,
  TierBadge,
  UserIcon,
} from "@/components/ds";
import { useGame } from "@/hooks/queries";
import { formatPrice, formatWhen } from "@/lib/format";
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

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this game."} onRetry={refetch} />
      </Screen>
    );
  }

  const price = game ? formatPrice(game.pricePaise) : null;

  return (
    <Screen padded={false}>
      <HeroNav onBack={router.back} onShare={() => {}} />
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
                <MetaRow icon={<ClockIcon color={color.dim} />} text={new Date(game.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} />
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

              <View style={styles.organizer}>
                <Text style={styles.label}>Organizer</Text>
                <Text style={styles.orgName}>{game.organizer.name}</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {game && (
        <StickyCTA
          price={price}
          caption={price ? "per player" : undefined}
          ctaLabel={game.viewerJoined ? "You’re in" : price ? `Pay ${price}` : "Join game"}
          onPress={() => {}}
          disabled
        />
      )}
    </Screen>
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
  organizer: { marginTop: space(5), gap: space(1) },
  label: { ...type.label, color: color.dim },
  orgName: { ...type.heading, color: color.text },
  gap: { marginTop: space(3) },
});
