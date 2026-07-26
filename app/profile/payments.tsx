/**
 * Payments history (M11, reused by M6 reconciliation). Status-aware rows incl. "confirming…".
 */
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import type { PaymentRecord, PaymentStatus } from "@/api/types";
import { ErrorState, HeroNav, Screen } from "@/components/chrome";
import { Skeleton } from "@/components/ds";
import { usePaymentsHistory } from "@/hooks/queries";
import { formatAmount, formatWhen } from "@/lib/format";
import { color, layout, space, type } from "@/lib/tokens";

const STATUS: Record<PaymentStatus, { label: string; tone: keyof typeof toneColor }> = {
  paid: { label: "Paid", tone: "success" },
  created: { label: "Confirming…", tone: "dim" },
  attempted: { label: "Confirming…", tone: "dim" },
  failed: { label: "Failed", tone: "danger" },
};

const toneColor = { success: color.success, dim: color.dim, danger: color.redLight } as const;

export default function Payments() {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = usePaymentsHistory();

  return (
    <Screen padded={false}>
      <View style={styles.nav}>
        <HeroNav onBack={router.back} />
      </View>
      <Text style={styles.title}>Payments</Text>

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={56} style={styles.skel} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load payments."} onRetry={refetch} />
      ) : (data?.length ?? 0) === 0 ? (
        <Text style={styles.empty}>No payments yet.</Text>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(p) => p.orderId}
          contentContainerStyle={styles.list}
          renderItem={({ item }: { item: PaymentRecord }) => {
            const s = STATUS[item.status];
            return (
              <View style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.entity}>
                    {item.entityType[0].toUpperCase() + item.entityType.slice(1)}
                  </Text>
                  <Text style={styles.at}>{formatWhen(item.createdAt)}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.amount}>{formatAmount(item.amountPaise)}</Text>
                  <Text style={[styles.status, { color: toneColor[s.tone] }]}>{s.label}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: space(6) },
  title: { ...type.title1, color: color.text, paddingHorizontal: layout.screenX, paddingBottom: space(3) },
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(10) },
  skel: { marginBottom: space(2) },
  empty: { ...type.body, color: color.dim, paddingHorizontal: layout.screenX },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: color.border },
  rowText: { gap: space(0.5) },
  entity: { ...type.bodyStrong, color: color.text },
  at: { ...type.caption, color: color.dim },
  rowRight: { alignItems: "flex-end", gap: space(0.5) },
  amount: { fontFamily: type.heading.fontFamily, fontSize: 14, color: color.text },
  status: { ...type.caption },
});
