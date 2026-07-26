/** One registerable directory (M9). Entity-agnostic: driven entirely by the passed config. */
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { RefreshControl, StyleSheet, View } from "react-native";

import { RegistrationCard } from "@/components/cards";
import { EmptyState, ErrorState } from "@/components/chrome";
import { CardSkeleton, DiscoverIcon } from "@/components/ds";
import * as haptics from "@/lib/haptics";
import { color, icon as iconSize, layout, space } from "@/lib/tokens";

import type { EntityConfig } from "./entities";
import { toRegistrationCard, useRegisterableList } from "./hooks";

export function DiscoverSegment({ config, q }: { config: EntityConfig; q: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch, isRefetching } = useRegisterableList(config, q);
  const empty = data && data.length === 0;

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
    return (
      <EmptyState
        icon={<DiscoverIcon size={iconSize.empty} color={color.red} />}
        headline="Nothing scheduled — check back soon."
        body={`New ${config.pluralLabel.toLowerCase()} will show up here.`}
      />
    );
  }

  return (
    <FlashList
      data={data}
      keyExtractor={(x) => x.id}
      contentContainerStyle={styles.list}
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
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(24) },
  rowGap: { marginBottom: space(3) },
  sep: { height: space(3) },
});
