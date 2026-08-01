/**
 * Discover (M9). Camps / Workshops / Events under a segmented control, each rendered by the
 * shared DiscoverSegment driven by its entity config. Search is per-segment (the entity list
 * endpoints support ?q=) — the global /search modal doesn't cover workshops, so it lives here.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RegisterableKind } from "@/api/types";
import { Header, OfflineBanner, Screen, SegmentedControl } from "@/components/chrome";
import { SearchBar } from "@/components/ds";
import { DiscoverSegment, ENTITIES } from "@/features/registration";
import { useAuth } from "@/hooks/useAuth";
import { useDebounce } from "@/hooks/useDebounce";
import { useIsOnline } from "@/hooks/useIsOnline";
import { layout, space } from "@/lib/tokens";

const SEGMENTS: { key: RegisterableKind; label: string }[] = [
  { key: "camp", label: "Camps" },
  { key: "workshop", label: "Workshops" },
  { key: "event", label: "Events" },
];

export default function DiscoverTab() {
  const router = useRouter();
  const { user } = useAuth();
  const [segment, setSegment] = useState<RegisterableKind>("camp");
  const [rawQuery, setRawQuery] = useState("");
  const q = useDebounce(rawQuery.trim(), 300);
  const online = useIsOnline();

  return (
    <Screen padded={false}>
      <Header
        title="Discover"
        me={user ? { name: user.name, uri: user.avatarUrl, onPress: () => router.push("/profile") } : undefined}
      />
      {!online && <OfflineBanner />}
      <View style={styles.controls}>
        <SearchBar
          value={rawQuery}
          onChangeText={setRawQuery}
          placeholder={`Search ${(SEGMENTS.find((s) => s.key === segment)?.label ?? "").toLowerCase()}`}
        />
      </View>
      <View style={styles.controls}>
        <SegmentedControl segments={SEGMENTS} value={segment} onChange={setSegment} />
      </View>
      <DiscoverSegment config={ENTITIES[segment]} q={q} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: layout.screenX, paddingBottom: space(3) },
});
