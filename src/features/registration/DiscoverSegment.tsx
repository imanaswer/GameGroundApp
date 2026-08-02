/** One registerable directory (M9). Entity-agnostic: driven entirely by the passed config. */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";

import { RegistrationCard } from "@/components/cards";
import { EmptyState, ErrorState, useTabBarPadding } from "@/components/chrome";
import { Appear, CardSkeleton, DiscoverIcon } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
import { toRegistrationCard, useRegisterableList } from "./hooks";

export function DiscoverSegment({ config, q }: { config: EntityConfig; q: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useRegisterableList(config, q);
  const empty = data && data.length === 0;
  const bottomPad = useTabBarPadding();

  if (isLoading) {
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.rowGap}>
            <CardSkeleton />
          </View>
        ))}
      </View>
    );
  }
  if (isError) return <ErrorState message={(error as Error)?.message ?? "Couldn’t load."} onRetry={refetch} />;
  if (empty) {
    const searching = q.length > 0;
    const plural = config.pluralLabel.toLowerCase();
    return (
      <EmptyState
        icon={<DiscoverIcon size={iconSize.empty} color={color.red} />}
        headline={searching ? `No ${plural} match “${q}”.` : "Nothing scheduled — check back soon."}
        body={searching ? "Try a different search." : `New ${plural} will show up here.`}
      />
    );
  }

  return (
    // Keyed on the segment so switching Camps↔Workshops↔Events re-runs the entrance (MOTION §2);
    // in-place search-query updates (same kind) don't remount, so results refine smoothly.
    <Appear key={config.kind} style={styles.listWrap}>
      <FlashList
        data={data}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ ...styles.list, paddingBottom: bottomPad }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <RegistrationCard data={toRegistrationCard(item)} onPress={() => router.push(`/${config.kind}/${item.id}`)} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              haptics.refresh();
              refetch();
            }}
            tintColor={color.dim}
          />
        }
      />
    </Appear>
  );
}

const styles = StyleSheet.create({
  listWrap: { flex: 1 },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(24) },
  rowGap: { marginBottom: space(3) },
  sep: { height: space(3) },
});
