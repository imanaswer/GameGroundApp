/**
 * Coach detail (M8). One scroll: head → Batches (book → M6 checkout) → Facility gallery (pinch-zoom
 * lightbox) → About → Reviews (server-eligibility gated). Sticky footer = session price + WhatsApp.
 */
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import type { CoachBatch } from "@/api/types";
import { ErrorState, HeroNav, ParallaxHero, Screen, Sheet, StickyCTA } from "@/components/chrome";
import { CheckoutSheet } from "@/components/checkout";
import { Avatar, Button, Press, Skeleton, StarIcon, Stars } from "@/components/ds";
import { useCoach } from "@/hooks/queries";
import { useCheckout } from "@/hooks/useCheckout";
import { useIsOnline } from "@/hooks/useIsOnline";
import { usePush } from "@/hooks/usePush";
import { formatAmount, formatSessionRange } from "@/lib/format";
import { shareEntity } from "@/lib/share";
import { color, layout, radius, space, type } from "@/lib/tokens";

import { ReviewForm } from "@/components/coach/ReviewForm";

// Lazy: the pinch-zoom lightbox module loads only when a photo is first tapped (M15).
const Lightbox = lazy(() =>
  import("@/components/coach/Lightbox").then((m) => ({ default: m.Lightbox })),
);

export default function CoachDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: coach, isLoading, isError, error, refetch } = useCoach(id);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [booking, setBooking] = useState<CoachBatch | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const checkout = useCheckout("coach", id, booking ? { batchId: booking.id } : {});
  const online = useIsOnline();
  const { promptForPush } = usePush();

  const sheetDismissible = checkout.state !== "processing" && checkout.state !== "reconciling";
  const closeSheet = () => {
    setBooking(null);
    checkout.reset();
  };
  const onSupport = () => {
    const subject = encodeURIComponent(`Payment help — coach ${id}`);
    Linking.openURL(`mailto:support@gameground.net?subject=${subject}`).catch(() => {});
  };

  // First successful booking → offer reminders (shown once, §10.2).
  useEffect(() => {
    if (checkout.state === "success") promptForPush();
  }, [checkout.state, promptForPush]);

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this coach."} onRetry={refetch} />
      </Screen>
    );
  }

  const sessionLabel = coach ? formatSessionRange(coach.pricePaise, coach.pricePaiseMax) : null;

  return (
    <Screen padded={false}>
      <HeroNav
        onBack={router.back}
        onShare={() => coach && shareEntity("coach", coach.id, coach.name)}
        scrollY={scrollY}
        title={coach?.name}
        collapseAt={130}
      />
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ParallaxHero imageUrl={coach?.facilityImageUrl} height={180} scrollY={scrollY} />

        <View style={styles.body}>
          {isLoading || !coach ? (
            <>
              <View style={styles.headRow}>
                <Skeleton width={62} height={62} round={999} />
                <View style={styles.headText}>
                  <Skeleton width="60%" height={20} />
                  <Skeleton width="40%" height={13} style={styles.gapSm} />
                </View>
              </View>
              <Skeleton width="100%" height={64} round={radius.input} style={styles.gap} />
            </>
          ) : (
            <>
              <View style={styles.headRow}>
                <Avatar name={coach.name} uri={coach.avatarUrl} size={62} />
                <View style={styles.headText}>
                  <Text style={styles.name}>{coach.name}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.sport}>{coach.sport}</Text>
                    <Text style={styles.dot}>·</Text>
                    {coach.reviewCount > 0 ? (
                      <>
                        <StarIcon size={12} color={color.gold} />
                        <Text style={styles.ratingText}>{coach.rating.toFixed(1)}</Text>
                      </>
                    ) : (
                      <Text style={styles.ratingText}>New</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Batches */}
              <View style={styles.section}>
                <Text style={styles.label}>Batches</Text>
                {coach.batches.length === 0 ? (
                  <Text style={styles.muted}>No batches open right now.</Text>
                ) : (
                  coach.batches.map((b) => (
                    <View key={b.id} style={styles.batch}>
                      <View style={styles.batchText}>
                        <Text style={styles.batchName}>{b.name}</Text>
                        <Text style={styles.muted}>
                          {[b.schedule, `${b.spotsLeft} seats left`].filter(Boolean).join(" · ")}
                        </Text>
                      </View>
                      {/* Ranged-price coaches are request-only — the server refuses their
                          checkout, so offering Book would walk the user into a 400. */}
                      {coach.instantPayEligible && (
                        <Button
                          title="Book"
                          variant="mini"
                          onPress={() => setBooking(b)}
                          disabled={b.spotsLeft <= 0 || !online}
                        />
                      )}
                    </View>
                  ))
                )}
                {coach.batches.length > 0 && !coach.instantPayEligible && (
                  <Text style={styles.muted}>
                    This coach takes bookings by request — message them to arrange a session.
                  </Text>
                )}
              </View>

              {/* Facility gallery */}
              {coach.photos.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.label}>Facility</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
                    {coach.photos.map((uri, i) => (
                      <Press key={i} accessibilityRole="imagebutton" onPress={() => setLightbox(i)} style={styles.photo}>
                        <Image source={{ uri }} style={styles.photoImg} contentFit="cover" recyclingKey={uri} />
                      </Press>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* About */}
              {!!coach.bio && (
                <View style={styles.section}>
                  <Text style={styles.label}>About</Text>
                  <Text style={styles.bio}>{coach.bio}</Text>
                </View>
              )}

              {/* Reviews */}
              {(coach.viewerCanReview || coach.reviews.length > 0) && (
                <View style={styles.section}>
                  <Text style={styles.label}>Reviews</Text>
                  {coach.viewerCanReview && <ReviewForm coachId={id} />}
                  {coach.reviews.map((r) => (
                    <View key={r.id} style={styles.review}>
                      <View style={styles.reviewHead}>
                        <Avatar name={r.author.name} uri={r.author.avatarUrl} size={28} />
                        <Text style={styles.reviewAuthor}>{r.author.name}</Text>
                        <Stars value={r.rating} size={11} />
                      </View>
                      <Text style={styles.reviewBody}>{r.body}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {coach && !booking && (
        <StickyCTA
          price={sessionLabel}
          ctaLabel="Message on WhatsApp"
          onPress={() => coach.whatsapp && Linking.openURL(`https://wa.me/${coach.whatsapp}`)}
          disabled={!coach.whatsapp}
        />
      )}

      {lightbox !== null && coach && (
        <Suspense fallback={null}>
          <Lightbox photos={coach.photos} index={lightbox} onClose={() => setLightbox(null)} />
        </Suspense>
      )}

      {coach && (
        <Sheet visible={!!booking} dismissible={sheetDismissible} onDismiss={closeSheet}>
          <CheckoutSheet
            state={checkout.state}
            phase={checkout.phase}
            error={checkout.error}
            amount={booking ? formatAmount(booking.pricePaise) : ""}
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

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(28) },
  body: { paddingHorizontal: layout.screenX, marginTop: -space(8), gap: space(5) },
  headRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  headText: { flex: 1, gap: space(1.5) },
  name: { ...type.title2, color: color.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  sport: { ...type.body, color: color.dim },
  dot: { ...type.body, color: color.dim2 },
  ratingText: { ...type.bodyStrong, color: color.gold },

  section: { gap: space(2.5) },
  label: { ...type.label, color: color.dim },
  muted: { ...type.body, color: color.dim },
  bio: { ...type.body, color: color.dim, lineHeight: 20 },

  batch: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5), gap: space(3) },
  batchText: { flex: 1, gap: space(1) },
  batchName: { ...type.heading, color: color.text },

  gallery: { gap: space(2.5) },
  photo: { width: 150, aspectRatio: 1.2, borderRadius: radius.tile, overflow: "hidden", backgroundColor: color.imagePlaceholder },
  photoImg: { width: "100%", height: "100%" },

  review: { gap: space(1.5), paddingVertical: space(2) },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: space(2) },
  reviewAuthor: { ...type.bodyStrong, color: color.text, flex: 1 },
  reviewBody: { ...type.body, color: color.dim, lineHeight: 19 },

  gap: { marginTop: space(3) },
  gapSm: { marginTop: space(1.5) },
});
