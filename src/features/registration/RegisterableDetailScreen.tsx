/**
 * Shared detail for camp / workshop / event (M9). One screen, parameterized by entity config.
 * Renders the full web content: meta, capacity, about, highlights, what's included, what to bring /
 * requirements, instructor, organizer, deadline, and (events) announcements. The registration form +
 * checkout are identical across all three (§9 — if a new payment branch appears here, the design is wrong).
 */
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, ScrollView as RNScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";

import { DateBadge, ErrorState, HeroNav, ParallaxHero, Screen, StickyCTA, useToast } from "@/components/chrome";
import { Avatar, Badge, CalendarIcon, CheckIcon, ChevronRightIcon, MapPinIcon, Skeleton, SlotBar, UserIcon } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import { useIsOnline } from "@/hooks/useIsOnline";
import { formatDate, formatPrice, formatSpots } from "@/lib/format";
import { shareEntity } from "@/lib/share";
import { color, layout, radius, space, type } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
import { RegistrationForm } from "./RegistrationForm";
import { useCancelRegistration, useRegisterableDetail } from "./hooks";

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

const KIND_LABEL: Record<string, string> = { camp: "Camp", workshop: "Workshop", event: "Event" };

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <View style={styles.bullets}>
      {items.map((it, i) => (
        <View key={i} style={[styles.bullet, i > 0 && styles.bulletDivider]}>
          <View style={styles.bulletBadge}>
            <CheckIcon size={14} color={color.success} />
          </View>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function RegisterableDetailScreen({ config, id }: { config: EntityConfig; id: string }) {
  const router = useRouter();
  const { data: item, isLoading, isError, error, refetch } = useRegisterableDetail(config, id);
  const [registering, setRegistering] = useState(false);
  const cancelReg = useCancelRegistration(config, id);
  const toast = useToast();
  const online = useIsOnline();
  const scrollRef = useRef<RNScrollView>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  // The form mounts at the end of a long scroll — bring it into view so tapping Register isn't a no-op.
  useEffect(() => {
    if (!registering) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [registering]);

  const openDirections = () => {
    if (!item?.location) return;
    const q = encodeURIComponent(item.location);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this."} onRetry={refetch} />
      </Screen>
    );
  }

  const price = item ? formatPrice(item.pricePaise) : null;
  const full = !!item && item.capacity > 0 && item.registered >= item.capacity;
  const ageSkill = item ? [item.ageGroup, item.skillLevel].filter(Boolean).join(" · ") : "";

  const reg = item?.viewerRegistration ?? null;
  // Events run a manual-approval mode, so paid ≠ confirmed. Say which it actually is.
  const regStatus = !reg
    ? undefined
    : reg.status === "pending"
      ? "Awaiting approval"
      : reg.status === "rejected"
        ? "Registration declined"
        : "You’re registered";

  const confirmCancel = () => {
    Alert.alert("Cancel this registration?", "Your place is released to someone else.", [
      { text: "Keep it", style: "cancel" },
      {
        text: "Cancel registration",
        style: "destructive",
        onPress: () =>
          cancelReg.mutate(undefined, {
            onSuccess: () => toast.show({ title: "Registration cancelled" }),
            // Most likely the server's 90-minute pre-start cutoff — surface its reason verbatim.
            onError: (e: unknown) =>
              toast.show({ title: "Couldn’t cancel", body: (e as Error).message }),
          }),
      },
    ]);
  };

  return (
    <Screen padded={false}>
      <HeroNav
        onBack={router.back}
        onShare={() => item && shareEntity(config.kind, item.id, item.title)}
        scrollY={scrollY}
        title={item?.title}
        collapseAt={150}
      />
      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ParallaxHero
          imageUrl={item?.imageUrl}
          height={240}
          scrollY={scrollY}
          topRight={item ? <DateBadge iso={item.startsAt} /> : undefined}
        >
          {item && (
            <View style={styles.heroOverlay}>
              <View style={styles.heroBadges}>
                <Badge label={KIND_LABEL[config.kind] ?? config.label} tone="red" />
                {!!item.sport && <Badge label={item.sport} />}
              </View>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          )}
        </ParallaxHero>

        <View style={styles.body}>
          {isLoading || !item ? (
            <>
              <Skeleton width="75%" height={24} />
              <Skeleton width="50%" height={14} style={styles.gap} />
            </>
          ) : (
            <>
              <View style={styles.metaBlock}>
                <MetaTile
                  icon={<CalendarIcon size={17} color={color.redLight} />}
                  label={item.dateLabel ?? formatDate(item.startsAt)}
                  sub={item.duration ?? undefined}
                />
                {!!item.location && (
                  <MetaTile
                    icon={<MapPinIcon size={17} color={color.redLight} />}
                    label={item.location}
                    sub="Get directions"
                    onPress={openDirections}
                  />
                )}
                {!!ageSkill && (
                  <MetaTile icon={<UserIcon size={17} color={color.redLight} />} label={ageSkill} sub="Recommended" />
                )}
              </View>

              <View style={styles.slot}>
                <SlotBar joined={item.registered} total={item.capacity} hideCaption />
                <Text style={styles.spots}>{formatSpots(item.registered, item.capacity)}</Text>
              </View>

              {/* A declined registration is otherwise invisible — the organiser's reason is the
                  only thing that explains it, so it leads rather than hiding below the fold. */}
              {reg?.status === "rejected" && !!reg.rejectionReason && (
                <Section label="Why this was declined">
                  <Text style={styles.description}>{reg.rejectionReason}</Text>
                </Section>
              )}

              {!!item.description && (
                <Section label="About">
                  <Text style={styles.description}>{item.description}</Text>
                </Section>
              )}

              {!!item.highlights?.length && (
                <Section label="Highlights">
                  <Bullets items={item.highlights} />
                </Section>
              )}

              {!!item.included?.length && (
                <Section label="What’s included">
                  <Bullets items={item.included} />
                </Section>
              )}

              {!!item.whatToBring?.length && (
                <Section label="What to bring">
                  <Bullets items={item.whatToBring} />
                </Section>
              )}

              {!!item.requirements?.length && (
                <Section label="Requirements">
                  <Bullets items={item.requirements} />
                </Section>
              )}

              {item.instructor && (
                <Section label="Instructor">
                  <View style={styles.instructor}>
                    <Avatar name={item.instructor.name} uri={item.instructor.imageUrl} size={48} />
                    <View style={styles.instructorText}>
                      <Text style={styles.instructorName}>{item.instructor.name}</Text>
                      {!!item.instructor.credentials && (
                        <Text style={styles.instructorCred}>{item.instructor.credentials}</Text>
                      )}
                      {!!item.instructor.bio && <Text style={styles.instructorBio}>{item.instructor.bio}</Text>}
                    </View>
                  </View>
                </Section>
              )}

              {(!!item.organizer || !!item.organizerContact || !!item.registrationDeadline) && (
                <Section label="Details">
                  <View style={styles.detailCard}>
                    {!!item.organizer && <DetailRow label="Organizer" value={item.organizer} />}
                    {!!item.organizerContact && <DetailRow label="Contact" value={item.organizerContact} />}
                    {!!item.registrationDeadline && (
                      <DetailRow label="Registration closes" value={formatDate(item.registrationDeadline)} />
                    )}
                  </View>
                </Section>
              )}

              {/* Events: announcements feed (§9). */}
              {item.announcements && item.announcements.length > 0 && (
                <Section label="Announcements">
                  {item.announcements.map((a) => (
                    <View key={a.id} style={styles.announcement}>
                      <Text style={styles.annTitle}>{a.title}</Text>
                      <Text style={styles.annBody}>{a.body}</Text>
                    </View>
                  ))}
                </Section>
              )}

              {registering && (
                <View style={styles.formHost}>
                  <RegistrationForm
                    config={config}
                    entityId={id}
                    amountPaise={item.pricePaise ?? 0}
                    onClose={() => setRegistering(false)}
                  />
                </View>
              )}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {item && !registering && (
        <StickyCTA
          testID="registerable-cta"
          price={reg ? undefined : price}
          status={regStatus}
          caption={!online ? "Offline — reconnect to register" : !reg && price ? "per registration" : undefined}
          ctaLabel={reg ? "Cancel registration" : full ? "Fully booked" : "Register"}
          buttonVariant={reg ? "secondary" : "primary"}
          onPress={reg ? confirmCancel : () => setRegistering(true)}
          loading={cancelReg.isPending}
          disabled={!reg && (full || !online)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(28) },
  body: { paddingHorizontal: layout.screenX, marginTop: space(4), gap: space(2) },

  // hero overlay (badges + title pinned to the bottom of the image)
  heroOverlay: { paddingHorizontal: layout.screenX, paddingBottom: space(4), gap: space(2.5) },
  heroBadges: { flexDirection: "row", gap: space(1.5) },
  heroTitle: { ...type.title1, color: color.text },

  // icon-tile meta rows
  metaBlock: { gap: space(3) },
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
  slot: { marginTop: space(4), gap: space(2) },
  spots: { ...type.caption, color: color.dim },

  section: { marginTop: space(5), gap: space(2.5) },
  label: { ...type.label, color: color.dim },
  description: { ...type.body, color: color.dim, lineHeight: 21 },

  bullets: {
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space(3.5),
  },
  bullet: { flexDirection: "row", alignItems: "center", gap: space(3), paddingVertical: space(2.75) },
  bulletDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.border },
  bulletBadge: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: color.successSurface,
    borderWidth: 1.5,
    borderColor: color.success,
    alignItems: "center",
    justifyContent: "center",
    // Soft green glow (iOS; Android falls back to the ring + tint).
    shadowColor: color.success,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  bulletText: { ...type.body, color: color.text, flex: 1 },

  instructor: { flexDirection: "row", gap: space(3), backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5) },
  instructorText: { flex: 1, gap: space(1) },
  instructorName: { ...type.heading, color: color.text },
  instructorCred: { ...type.caption, color: color.redLight },
  instructorBio: { ...type.body, color: color.dim, lineHeight: 19, marginTop: space(1) },

  detailCard: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, paddingHorizontal: space(3.5), paddingVertical: space(1.5) },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space(3), paddingVertical: space(2.5) },
  detailLabel: { ...type.caption, color: color.dim },
  detailValue: { ...type.body, color: color.text, flexShrink: 1, textAlign: "right" },

  announcement: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5), gap: space(1) },
  annTitle: { ...type.heading, color: color.text },
  annBody: { ...type.body, color: color.dim, lineHeight: 19 },

  formHost: { marginTop: space(5), marginHorizontal: -layout.screenX },
  gap: { marginTop: space(3) },
});
