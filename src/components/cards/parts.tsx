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
    backgroundColor: color.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  body: { padding: layout.cardPad, gap: space(2) },
  title: { ...type.heading, color: color.text },
  price: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.gold },
  free: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.success },
});

const styles = StyleSheet.create({
  imageWrap: { backgroundColor: color.imagePlaceholder },
  overlay: { ...StyleSheet.absoluteFill, padding: space(2.5), justifyContent: "space-between" },
  meta: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  metaText: { ...type.caption, color: color.dim, flexShrink: 1 },
});
