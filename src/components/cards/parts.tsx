/** Shared card interior parts (DESIGN_SYSTEM.md §6). Image with scrim, MetaRow. */
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import { color, radius, space, type } from "@/lib/tokens";
import { themed, useGradients, useThemedStyles } from "@/theme/runtime";

export function CardImage({
  uri,
  height,
  children,
}: {
  uri?: string | null;
  height: number;
  children?: React.ReactNode;
}) {
  const styles = useThemedStyles(sheets);
  const gradient = useGradients();
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
  const styles = useThemedStyles(sheets);
  return (
    <View style={styles.meta}>
      {icon}
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export const cardStyles = themed(() => ({
  /**
   * BORDERED card. The edge is back, and it is back in both themes.
   *
   * Phase 5 made these editorial — no fill, no border — on the argument that a white page plus a
   * photograph is already contrast enough, so a hairline was chrome drawing a line beside an edge
   * that already read. That argument was true, and it was true only of light. Decision 24 gave the
   * app a #050505 ground, which is the exact condition the box treatment existed for in the first
   * place: a card with no fill and no edge on near-black has no boundary at all, so a rail of them
   * reads as loose images and captions floating on the page. Reported on device by Anaswer.
   *
   * `border` (not `border2`) is DS §3's rest elevation; `border2` stays the raised weight, which is
   * what UpNextHeroCard uses to sit forward of the cards around it. No fill: the request was an
   * edge, and a `card` fill would also flatten the photograph's own contrast against the page.
   *
   * `overflow: hidden` + radius clips the image corners to the box, so the border closes around the
   * photograph instead of crossing it.
   */
  card: {
    backgroundColor: "transparent",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  // Now that there IS a box, type is inset from it — 12pt, DS §3's card internal padding. Flush
  // type was correct only while the only edge was the photograph's.
  body: { paddingTop: space(2.5), paddingBottom: space(2), paddingHorizontal: space(3), gap: space(1.5) },
  title: { ...type.heading, color: color.text },
  // Price is plain ink. It was `gold` (warning-500), which measures ~3.6:1 on a card — under AA
  // for what is often the single most decision-relevant string on the screen. The source prices
  // everything in plain black anyway; it has no accent to spend on money.
  price: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.text },
  // `success` is a fill colour: 2.2:1 as text. Same trap as StickyCTA in Phase 2.
  free: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.successText },
}));

const sheets = themed(() => ({
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
}));
