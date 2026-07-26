/**
 * Coach detail (M8). Overview / Batches / Photos / Reviews tabs, pinch-zoom lightbox,
 * WhatsApp deep link, book batch → M6 checkout (entity "coach", batchId in registration),
 * post-booking review with server eligibility errors rendered inline.
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";

import type { CoachBatch } from "@/api/types";
import { ErrorState, HeroNav, Screen, SegmentedControl } from "@/components/chrome";
import { CheckoutSheet } from "@/components/checkout";
import { Avatar, Button, MessageIcon, Press, Skeleton, Stars } from "@/components/ds";
import { useCoach } from "@/hooks/queries";
import { useCheckout } from "@/hooks/useCheckout";
import { usePush } from "@/hooks/usePush";
import { formatAmount, formatPrice } from "@/lib/format";
import { shareEntity } from "@/lib/share";
import { color, gradient, layout, radius, space, type } from "@/lib/tokens";

import { Lightbox } from "./_lightbox";
import { ReviewForm } from "./_review-form";

type Tab = "overview" | "batches" | "photos" | "reviews";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "batches", label: "Batches" },
  { key: "photos", label: "Photos" },
  { key: "reviews", label: "Reviews" },
];

export default function CoachDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: coach, isLoading, isError, error, refetch } = useCoach(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [booking, setBooking] = useState<CoachBatch | null>(null);

  const checkout = useCheckout("coach", id, booking ? { batchId: booking.id } : {});
  const { promptForPush } = usePush();

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

  return (
    <Screen padded={false}>
      <HeroNav onBack={router.back} onShare={() => coach && shareEntity("coach", coach.id, coach.name)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {coach?.facilityImageUrl ? (
            <Image source={{ uri: coach.facilityImageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
          {isLoading || !coach ? (
            <>
              <Skeleton width="60%" height={24} />
              <Skeleton width="40%" height={14} style={styles.gap} />
            </>
          ) : (
            <>
              <View style={styles.headRow}>
                <Avatar name={coach.name} uri={coach.avatarUrl} size={62} />
                <View style={styles.headText}>
                  <Text style={styles.name}>{coach.name}</Text>
                  <Text style={styles.sport}>
                    {coach.sport}
                    {coach.area ? ` · ${coach.area}` : ""}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Stars value={coach.rating} size={12} />
                    <Text style={styles.reviewCount}>({coach.reviewCount})</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tabs}>
                <SegmentedControl segments={TABS} value={tab} onChange={setTab} />
              </View>

              {tab === "overview" && (
                <View style={styles.section}>
                  <Text style={styles.bio}>{coach.bio}</Text>
                  {coach.whatsapp && (
                    <Button
                      title="Message on WhatsApp"
                      variant="secondary"
                      icon={<MessageIcon color={color.text} />}
                      onPress={() => Linking.openURL(`https://wa.me/${coach.whatsapp}`)}
                    />
                  )}
                </View>
              )}

              {tab === "batches" && (
                <View style={styles.section}>
                  {coach.batches.length === 0 ? (
                    <Text style={styles.muted}>No batches open right now.</Text>
                  ) : (
                    coach.batches.map((b) => (
                      <View key={b.id} style={styles.batch}>
                        <View style={styles.batchText}>
                          <Text style={styles.batchName}>{b.name}</Text>
                          <Text style={styles.muted}>
                            {b.schedule} · {b.spotsLeft} spots left
                          </Text>
                        </View>
                        <View style={styles.batchRight}>
                          <Text style={styles.price}>{formatPrice(b.pricePaise) ?? "Free"}</Text>
                          <Button title="Book" variant="mini" onPress={() => setBooking(b)} disabled={b.spotsLeft <= 0} />
                        </View>
                      </View>
                    ))
                  )}
                </View>
              )}

              {tab === "photos" && (
                <View style={styles.photoGrid}>
                  {coach.photos.map((uri, i) => (
                    <Press key={i} accessibilityRole="imagebutton" onPress={() => setLightbox(i)} style={styles.photo}>
                      <Image source={{ uri }} style={styles.photoImg} contentFit="cover" recyclingKey={uri} />
                    </Press>
                  ))}
                  {coach.photos.length === 0 && <Text style={styles.muted}>No photos yet.</Text>}
                </View>
              )}

              {tab === "reviews" && (
                <View style={styles.section}>
                  {coach.viewerCanReview && <ReviewForm coachId={id} />}
                  {coach.reviews.length === 0 ? (
                    <Text style={styles.muted}>No reviews yet.</Text>
                  ) : (
                    coach.reviews.map((r) => (
                      <View key={r.id} style={styles.review}>
                        <View style={styles.reviewHead}>
                          <Avatar name={r.author.name} uri={r.author.avatarUrl} size={28} />
                          <Text style={styles.reviewAuthor}>{r.author.name}</Text>
                          <Stars value={r.rating} size={11} />
                        </View>
                        <Text style={styles.reviewBody}>{r.body}</Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {lightbox !== null && coach && (
        <Lightbox photos={coach.photos} index={lightbox} onClose={() => setLightbox(null)} />
      )}

      {booking && (
        <View style={styles.sheetHost}>
          <CheckoutSheet
            state={checkout.state}
            phase={checkout.phase}
            error={checkout.error}
            amount={formatAmount(booking.pricePaise)}
            onPay={checkout.start}
            onRetry={checkout.retry}
            onSupport={() => {}}
          />
          {(checkout.state === "success" || checkout.state === "methods") && (
            <Press onPress={() => setBooking(null)} style={styles.done}>
              <Text style={styles.doneText}>{checkout.state === "success" ? "Done" : "Cancel"}</Text>
            </Press>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(24) },
  hero: { height: 180, backgroundColor: color.imagePlaceholder },
  heroFallback: { backgroundColor: color.card },
  body: { paddingHorizontal: layout.screenX, marginTop: -space(8), gap: space(3) },
  headRow: { flexDirection: "row", alignItems: "center", gap: space(3) },
  headText: { flex: 1, gap: space(1) },
  name: { ...type.title2, color: color.text },
  sport: { ...type.body, color: color.dim },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  reviewCount: { ...type.caption, color: color.dim },
  tabs: { marginTop: space(2) },
  section: { gap: space(3) },
  bio: { ...type.body, color: color.dim, lineHeight: 20 },
  muted: { ...type.body, color: color.dim },
  batch: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5), gap: space(3) },
  batchText: { flex: 1, gap: space(1) },
  batchName: { ...type.heading, color: color.text },
  batchRight: { alignItems: "flex-end", gap: space(2) },
  price: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.gold },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: space(2) },
  photo: { width: "31.5%", aspectRatio: 1, borderRadius: radius.tile, overflow: "hidden", backgroundColor: color.imagePlaceholder },
  photoImg: { width: "100%", height: "100%" },
  review: { gap: space(1.5), paddingVertical: space(2) },
  reviewHead: { flexDirection: "row", alignItems: "center", gap: space(2) },
  reviewAuthor: { ...type.bodyStrong, color: color.text, flex: 1 },
  reviewBody: { ...type.body, color: color.dim, lineHeight: 19 },
  gap: { marginTop: space(3) },
  sheetHost: { position: "absolute", left: 0, right: 0, bottom: 0 },
  done: { alignItems: "center", paddingVertical: space(4), backgroundColor: color.elev },
  doneText: { ...type.heading, color: color.text },
});
