/**
 * Shared detail for camp / workshop / event (M9). One screen, parameterized by entity config.
 * Events render an announcements feed; the registration form + checkout are identical across
 * all three (§9 — if a new payment branch appears here, the design is wrong).
 */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState, HeroNav, Screen, StickyCTA } from "@/components/chrome";
import { CalendarIcon, MapPinIcon, Skeleton, SlotBar } from "@/components/ds";
import { useIsOnline } from "@/hooks/useIsOnline";
import { formatPrice, formatWhen } from "@/lib/format";
import { shareEntity } from "@/lib/share";
import { color, gradient, layout, radius, space, type } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
import { RegistrationForm } from "./RegistrationForm";
import { useRegisterableDetail } from "./hooks";

export function RegisterableDetailScreen({ config, id }: { config: EntityConfig; id: string }) {
  const router = useRouter();
  const { data: item, isLoading, isError, error, refetch } = useRegisterableDetail(config, id);
  const [registering, setRegistering] = useState(false);
  const online = useIsOnline();

  if (isError) {
    return (
      <Screen>
        <HeroNav onBack={router.back} />
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load this."} onRetry={refetch} />
      </Screen>
    );
  }

  const price = item ? formatPrice(item.pricePaise) : null;
  const full = !!item && item.registered >= item.capacity;

  return (
    <Screen padded={false}>
      <HeroNav onBack={router.back} onShare={() => item && shareEntity(config.kind, item.id, item.title)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {item?.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
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
          {isLoading || !item ? (
            <>
              <Skeleton width="75%" height={24} />
              <Skeleton width="50%" height={14} style={styles.gap} />
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>{config.label}</Text>
              <Text style={styles.title}>{item.title}</Text>
              <View style={styles.metaBlock}>
                <View style={styles.meta}>
                  <CalendarIcon color={color.dim} />
                  <Text style={styles.metaText}>{formatWhen(item.startsAt)}</Text>
                </View>
                {!!item.location && (
                  <View style={styles.meta}>
                    <MapPinIcon color={color.dim} />
                    <Text style={styles.metaText}>{item.location}</Text>
                  </View>
                )}
              </View>

              <View style={styles.slot}>
                <SlotBar joined={item.registered} total={item.capacity} />
              </View>

              {!!item.description && <Text style={styles.description}>{item.description}</Text>}

              {/* Events: announcements feed (§9). */}
              {item.announcements && item.announcements.length > 0 && (
                <View style={styles.announcements}>
                  <Text style={styles.label}>Announcements</Text>
                  {item.announcements.map((a) => (
                    <View key={a.id} style={styles.announcement}>
                      <Text style={styles.annTitle}>{a.title}</Text>
                      <Text style={styles.annBody}>{a.body}</Text>
                    </View>
                  ))}
                </View>
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
      </ScrollView>

      {item && !registering && (
        <StickyCTA
          price={price}
          caption={!online ? "Offline — reconnect to register" : price ? "per registration" : undefined}
          ctaLabel={full ? "Fully booked" : "Register"}
          onPress={() => setRegistering(true)}
          disabled={full || !online}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space(28) },
  hero: { height: 220, backgroundColor: color.imagePlaceholder },
  heroFallback: { backgroundColor: color.card },
  body: { paddingHorizontal: layout.screenX, marginTop: -space(8), gap: space(2) },
  eyebrow: { ...type.label, color: color.redLight },
  title: { ...type.title1, color: color.text },
  metaBlock: { marginTop: space(2), gap: space(2.5) },
  meta: { flexDirection: "row", alignItems: "center", gap: space(2.5) },
  metaText: { ...type.body, color: color.text, flexShrink: 1 },
  slot: { marginTop: space(4) },
  description: { ...type.body, color: color.dim, lineHeight: 20, marginTop: space(4) },
  announcements: { marginTop: space(5), gap: space(2.5) },
  label: { ...type.label, color: color.dim },
  announcement: { backgroundColor: color.card, borderRadius: radius.input, borderWidth: 1, borderColor: color.border, padding: space(3.5), gap: space(1) },
  annTitle: { ...type.heading, color: color.text },
  annBody: { ...type.body, color: color.dim, lineHeight: 19 },
  formHost: { marginTop: space(5), marginHorizontal: -layout.screenX },
  gap: { marginTop: space(3) },
});
