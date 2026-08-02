/** Shared card interior parts (DESIGN_SYSTEM.md §6). Image with scrim, MetaRow. */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { color, gradient, layout, radius, space, type } from "@/lib/tokens";

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
  card: {
    // White, not the grey `card` wash. On the old #050505 ground a lighter fill was the ONLY way
    // to lift a card off the page — shadows are invisible on near-black. On white that inverts:
    // a grey fill inside a grey border is two kinds of chrome doing one job, and it muddies every
    // photograph sitting on it. The hairline carries the separation now.
    backgroundColor: color.elev,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  body: { padding: layout.cardPad, gap: space(2) },
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
