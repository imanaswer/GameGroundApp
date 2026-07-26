/**
 * DESIGN_SYSTEM.md §7 CheckoutSheet — VISUAL STATES ONLY (M3). The payment logic,
 * sheet physics, and verification wiring land in M6. This renders the four internal
 * states so they can be reviewed against the kit in the catalog.
 */
import { StyleSheet, Text, View } from "react-native";

import { Button, CheckIcon } from "@/components/ds";
import { color, radius, space, type } from "@/lib/tokens";

export type CheckoutState = "methods" | "processing" | "success" | "failure";

const METHODS = [
  { key: "upi", name: "UPI", caption: "GPay, PhonePe, any UPI app" },
  { key: "card", name: "Card", caption: "Credit or debit" },
];

const STEPS = ["Creating order", "Payment received", "Verifying with server"] as const;

export function CheckoutSheet({
  state,
  amount,
  onPay,
  onRetry,
}: {
  state: CheckoutState;
  amount: string;
  onPay?: () => void;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      {state === "methods" && <Methods amount={amount} onPay={onPay} />}
      {state === "processing" && <Processing />}
      {state === "success" && <Success amount={amount} />}
      {state === "failure" && <Failure onRetry={onRetry} />}
    </View>
  );
}

function Methods({ amount, onPay }: { amount: string; onPay?: () => void }) {
  return (
    <>
      <Text style={styles.header}>Complete payment</Text>
      <Text style={styles.amount}>{amount}</Text>
      <View style={styles.methods}>
        {METHODS.map((m, i) => (
          <View key={m.key} style={[styles.method, i === 0 && styles.methodSelected]}>
            <View style={styles.methodText}>
              <Text style={styles.methodName}>{m.name}</Text>
              <Text style={styles.methodCaption}>{m.caption}</Text>
            </View>
            <View style={[styles.radio, i === 0 && styles.radioOn]}>{i === 0 && <View style={styles.radioDot} />}</View>
          </View>
        ))}
      </View>
      <Button title={`Pay ${amount}`} onPress={onPay ?? (() => {})} />
      <Text style={styles.footnote}>Amount is confirmed by Game Ground’s server.</Text>
    </>
  );
}

/** VerificationTimeline (§7): steps flip on real state in production — static preview here. */
function Processing() {
  return (
    <>
      <Text style={styles.header}>Confirming your payment</Text>
      <View style={styles.timeline}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.step}>
            <View style={[styles.stepDot, i === 0 && styles.stepDone, i === 1 && styles.stepActive]}>
              {i === 0 && <CheckIcon size={12} color={color.bg} />}
            </View>
            <Text style={[styles.stepLabel, i <= 1 && styles.stepLabelOn]}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

function Success({ amount }: { amount: string }) {
  return (
    <View style={styles.centered}>
      <View style={styles.successRing}>
        <CheckIcon size={28} color={color.success} />
      </View>
      <Text style={styles.header}>You’re in</Text>
      <Text style={styles.footnote}>Paid {amount}. Your spot is confirmed.</Text>
    </View>
  );
}

function Failure({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.header}>Payment didn’t go through</Text>
      <Text style={styles.footnote}>You weren’t charged. Try again.</Text>
      <Button title="Try again" onPress={onRetry ?? (() => {})} style={styles.retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: color.elev, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, padding: space(5), gap: space(3) },
  handle: { width: 38, height: 4, borderRadius: 999, backgroundColor: color.border2, alignSelf: "center", marginBottom: space(2) },
  header: { ...type.heading, fontSize: 16, color: color.text },
  amount: { ...type.amount, color: color.text },
  footnote: { ...type.caption, color: color.dim },

  methods: { gap: space(2) },
  method: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    padding: space(3.5),
  },
  methodSelected: { borderColor: color.red, backgroundColor: color.redWash },
  methodText: { gap: space(0.5) },
  methodName: { ...type.bodyStrong, color: color.text },
  methodCaption: { ...type.caption, color: color.dim },
  radio: { width: 17, height: 17, borderRadius: 999, borderWidth: 2, borderColor: color.border2, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: color.red },
  radioDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: color.red },

  timeline: { gap: space(4), paddingVertical: space(3) },
  step: { flexDirection: "row", alignItems: "center", gap: space(3) },
  stepDot: { width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: color.dim2, alignItems: "center", justifyContent: "center" },
  stepActive: { borderColor: color.red },
  stepDone: { backgroundColor: color.success, borderColor: color.success },
  stepLabel: { ...type.body, color: color.dim2 },
  stepLabelOn: { color: color.text },

  centered: { alignItems: "center", gap: space(2), paddingVertical: space(4) },
  successRing: { width: 64, height: 64, borderRadius: 999, backgroundColor: color.successSurface, alignItems: "center", justifyContent: "center", marginBottom: space(2) },
  retry: { alignSelf: "stretch", marginTop: space(2) },
});
