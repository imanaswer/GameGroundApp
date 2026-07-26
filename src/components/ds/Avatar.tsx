/** DESIGN_SYSTEM.md §4 Avatar / AvatarStack. Image → initials fallback on identity color. */
import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { avatarColors, color, ownAvatarGradient, type } from "@/lib/tokens";

function identityColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

type Props = {
  name: string;
  uri?: string | null;
  size?: number;
  /** The signed-in user renders with the gradient identity (§1.3). */
  isSelf?: boolean;
};

export function Avatar({ name, uri, size = 32, isSelf = false }: Props) {
  const [failed, setFailed] = useState(false);
  const dim = { width: size, height: size, borderRadius: 999 };
  const label = <Text style={[styles.initials, { fontSize: size * 0.38 }]}>{initials(name)}</Text>;

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={dim}
        contentFit="cover"
        onError={() => setFailed(true)}
        accessibilityLabel={name}
      />
    );
  }
  if (isSelf) {
    return (
      <LinearGradient
        colors={ownAvatarGradient as unknown as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[dim, styles.center]}
      >
        {label}
      </LinearGradient>
    );
  }
  return <View style={[dim, styles.center, { backgroundColor: identityColor(name) }]}>{label}</View>;
}

/** −7 overlap, 2px card-color ring, `+N` overflow chip. */
export function AvatarStack({
  people,
  max = 4,
  size = 22,
}: {
  people: { name: string; uri?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View key={i} style={[styles.ring, { marginLeft: i === 0 ? 0 : -7, borderRadius: 999 }]}>
          <Avatar name={p.name} uri={p.uri} size={size} />
        </View>
      ))}
      {overflow > 0 && (
        <View style={[styles.ring, styles.overflow, { marginLeft: -7, width: size, height: size }]}>
          <Text style={[styles.overflowText, { fontSize: size * 0.36 }]}>+{overflow}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  initials: { fontFamily: type.heading.fontFamily, color: color.text },
  stack: { flexDirection: "row", alignItems: "center" },
  ring: { borderWidth: 2, borderColor: color.card },
  overflow: { backgroundColor: color.overflowChip, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  overflowText: { fontFamily: type.heading.fontFamily, color: color.text },
});
