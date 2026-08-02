/** Shared card interior parts (DESIGN_SYSTEM.md §6). Image with scrim, MetaRow. */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { color, gradient, radius, space, type } from "@/lib/tokens";

export function CardImage({
  uri,
  height,
  children,
}: {
  uri?: string | null;
  height: number;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.imageWrap, { height }]}>
      <Image
        source={uri ? { uri } : undefined}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        placeholder={undefined}
        transition={150}
        recyclingKey={uri ?? undefined}
      />
      <LinearGradient
        colors={gradient.imageScrim.colors as unknown as [string, string]}
        locations={gradient.imageScrim.locations as unknown as [number, number]}
        style={StyleSheet.absoluteFill}
      />
      {children && <View style={styles.overlay}>{children}</View>}
    </View>
  );
}

export function MetaRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export const cardStyles = StyleSheet.create({
  /**
   * EDITORIAL card (Phase 5). No fill, no border — the photograph and the type are the card.
   *
   * This is the shape change the port had not yet made. The box treatment (fill + hairline +
   * padding) existed because on `#050505` a card had to announce itself: a dark box on a dark
   * page is invisible without an edge. On white the opposite is true — the image already has
   * enormous contrast against the page, so a border around it is chrome drawing a line next to
   * something that was already a clear edge.
   *
   * `overflow: hidden` + radius still clips the image corners; the rounding now belongs to the
   * photograph rather than to a container around it.
   */
  card: {
    backgroundColor: "transparent",
    borderRadius: radius.card,
    overflow: "hidden",
  },
  // Type sits flush to the image edge — no horizontal inset, because there is no longer a box for
  // it to be inset FROM. Vertical rhythm is kept so stacked cards do not collide.
  body: { paddingTop: space(2.5), paddingBottom: space(2), gap: space(1.5) },
  title: { ...type.heading, color: color.text },
  // Price is plain ink. It was `gold` (warning-500), which measures ~3.6:1 on a card — under AA
  // for what is often the single most decision-relevant string on the screen. The source prices
  // everything in plain black anyway; it has no accent to spend on money.
  price: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.text },
  // `success` is a fill colour: 2.2:1 as text. Same trap as StickyCTA in Phase 2.
  free: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.successText },
});

const styles = StyleSheet.create({
  imageWrap: { backgroundColor: color.imagePlaceholder },
  // absoluteFillObject, not absoluteFill: only the former is typed as a plain object, so it is
  // the one that can be spread. (RN 0.86 typed both loosely enough; 0.81 does not.)
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: space(2.5),
    justifyContent: "space-between",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  metaText: { ...type.caption, color: color.dim, flexShrink: 1 },
});
