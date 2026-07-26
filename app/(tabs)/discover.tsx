/**
 * Discover (M9). Camps / Workshops / Events under a segmented control, each rendered by the
 * shared DiscoverSegment driven by its entity config. Search is shared across segments.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import type { RegisterableKind } from "@/api/types";
import { Header, Screen, SegmentedControl } from "@/components/chrome";
import { SearchBar } from "@/components/ds";
import { DiscoverSegment, ENTITIES } from "@/features/registration";
import { useDebounce } from "@/hooks/useDebounce";
import { layout, space } from "@/lib/tokens";

const SEGMENTS: { key: RegisterableKind; label: string }[] = [
  { key: "camp", label: "Camps" },
  { key: "workshop", label: "Workshops" },
  { key: "event", label: "Events" },
];

export default function DiscoverTab() {
  const [segment, setSegment] = useState<RegisterableKind>("camp");
  const [rawQuery, setRawQuery] = useState("");
  const q = useDebounce(rawQuery.trim(), 300);

  return (
    <Screen padded={false}>
      <Header title="Discover" />
      <View style={styles.controls}>
        <SearchBar value={rawQuery} onChangeText={setRawQuery} placeholder="Search camps, workshops, events" />
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
