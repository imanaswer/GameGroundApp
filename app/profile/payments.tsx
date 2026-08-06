/**
 * Payments history (M11, reused by M6 reconciliation). Status-aware rows incl. "confirming…".
 */
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";

import type { PaymentRecord, PaymentStatus } from "@/api/types";
import { EmptyState, ErrorState, PageNav, Screen } from "@/components/chrome";
import { CardIcon, Skeleton } from "@/components/ds";
import { usePaymentsHistory } from "@/hooks/queries";
import { formatAmount, formatWhen } from "@/lib/format";
import { color, icon as iconSize, layout, space, type } from "@/lib/tokens";
import type { Palette } from "@/theme/palette";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

const STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "success" },
  created: { label: "Confirming…", tone: "dim" },
  attempted: { label: "Confirming…", tone: "dim" },
  failed: { label: "Failed", tone: "danger" },
};

type Tone = "success" | "dim" | "danger";

/** A function, not a map: a module-scope map would freeze these at the palette that happened to
 *  be active when this file was first imported. Resolved per render instead. */
const toneColor = (tone: Tone, palette: Palette): string =>
  tone === "success" ? palette.successText : tone === "danger" ? palette.primarySoft : palette.dim;

export default function Payments() {
  const styles = useThemedStyles(sheets);
  const color = usePalette();
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = usePaymentsHistory();

  return (
    <Screen padded={false}>
      <PageNav title="Payments" onBack={router.back} />

      {isLoading ? (
        <View style={styles.list}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={56} style={styles.skel} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState message={(error as Error)?.message ?? "Couldn’t load payments."} onRetry={refetch} />
      ) : (data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<CardIcon size={iconSize.empty} color={color.primary} />}
          headline="No payments yet"
          body="Your bookings and receipts will show up here."
        />
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
                  <Text style={[styles.status, { color: toneColor(s.tone, color) }]}>{s.label}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </Screen>
  );
}

const sheets = themed(() => ({
  list: { paddingHorizontal: layout.screenX, paddingBottom: space(10) },
  skel: { marginBottom: space(2) },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space(3), borderBottomWidth: 1, borderBottomColor: color.border },
  rowText: { gap: space(0.5) },
  entity: { ...type.bodyStrong, color: color.text },
  at: { ...type.caption, color: color.dim },
  rowRight: { alignItems: "flex-end", gap: space(0.5) },
  amount: { ...type.heading, color: color.text },
  status: { ...type.caption },
}));
