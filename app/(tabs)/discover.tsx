/**
 * Discover shell (M4). The segmented control is wired now so deep links resolve to the
 * right segment; each segment renders an empty state until M9 fills it with real data.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { DiscoverIcon } from "@/components/ds";
import { EmptyState, Header, Screen, SegmentedControl } from "@/components/chrome";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

type Segment = "camps" | "workshops" | "events";

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "camps", label: "Camps" },
  { key: "workshops", label: "Workshops" },
  { key: "events", label: "Events" },
];

export default function DiscoverTab() {
  const [segment, setSegment] = useState<Segment>("camps");

  return (
    <Screen padded={false}>
      <Header title="Discover" />
      <View style={styles.controls}>
        <SegmentedControl segments={SEGMENTS} value={segment} onChange={setSegment} />
      </View>
      <EmptyState
        icon={<DiscoverIcon size={iconSize.empty} color={color.red} />}
        headline="Nothing scheduled — check back soon."
        body="Camps, workshops and events land here once M9 wires them up."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: layout.screenX, paddingBottom: space(3) },
});
