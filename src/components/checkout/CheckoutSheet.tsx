/**
 * DESIGN_SYSTEM.md §7 CheckoutSheet. Visual states shipped in M3; in M6 the timeline is
 * driven by the real machine phase (creating/gateway/verifying) and the reconciling /
 * unresolved states (§9.4) are added. The sheet never fabricates progress on a timer.
 */
import { StyleSheet, Text, View } from "react-native";

import { Button, CheckIcon, Confetti } from "@/components/ds";
import { color, radius, space, type } from "@/lib/tokens";

export type CheckoutState =
  | "methods"
  | "processing"
  | "success"
  | "failure"
  | "reconciling"
  | "unresolved";

/** Machine phase → which timeline step is active (§9.1 VerificationTimeline). */
export type TimelinePhase = "creating" | "gateway" | "verifying" | null;

const METHODS = [
  { key: "upi", name: "UPI", caption: "GPay, PhonePe, any UPI app" },
  { key: "card", name: "Card", caption: "Credit or debit" },
];

const STEPS = ["Creating order", "Payment received", "Verifying with server"] as const;

export function CheckoutSheet({
  state,
  amount,
  phase = null,
  error,
  onPay,
  onRetry,
  onSupport,
}: {
  state: CheckoutState;
  amount: string;
  phase?: TimelinePhase;
  error?: string | null;
  onPay?: () => void;
  onRetry?: () => void;
  onSupport?: () => void;
}) {
  return (
    <View style={styles.sheet}>
      <View style={styles.handle} />
      {state === "methods" && <Methods amount={amount} onPay={onPay} />}
      {state === "processing" && <Processing phase={phase} />}
      {state === "reconciling" && <Reconciling />}
      {state === "success" && <Success amount={amount} />}
      {state === "failure" && <Failure message={error} onRetry={onRetry} />}
      {state === "unresolved" && <Unresolved onSupport={onSupport} />}
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

/** VerificationTimeline (§7/§9.1): steps flip on the REAL machine phase, never on timers. */
function Processing({ phase }: { phase: TimelinePhase }) {
  // How many steps are done: creating→0 done, gateway→1 done, verifying→2 done.
  const done = phase === "gateway" ? 1 : phase === "verifying" ? 2 : 0;
  return (
    <>
      <Text style={styles.header}>Confirming your payment</Text>
      <View style={styles.timeline}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.step}>
            <View style={[styles.stepDot, i < done && styles.stepDone, i === done && styles.stepActive]}>
              {i < done && <CheckIcon size={12} color={color.bg} />}
            </View>
            <Text style={[styles.stepLabel, i <= done && styles.stepLabelOn]}>{label}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

/** §9.4 — debited but not yet confirmed. Non-blocking, no spinner-as-failure. */
function Reconciling() {
  return (
    <View style={styles.centered}>
      <Text style={styles.header}>Payment received — confirming…</Text>
      <Text style={styles.footnote}>
        We’ve got your payment and are confirming your spot. This usually takes a moment.
      </Text>
    </View>
  );
}

/** §9.4 — 5-minute cap elapsed unresolved. Route to support with the order ref. */
function Unresolved({ onSupport }: { onSupport?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.header}>Still confirming</Text>
      <Text style={styles.footnote}>
        This is taking longer than usual. If you were charged, our team will sort it out — no
        duplicate charge will happen.
      </Text>
      <Button title="Contact support" variant="secondary" onPress={onSupport ?? (() => {})} style={styles.retry} />
    </View>
  );
}

function Success({ amount }: { amount: string }) {
  // Extended success (MOTION §5): confetti burst over the check. The reputation-gain card +
  // avatar-into-stack need the server rep delta from the refetched profile — see BACKLOG (M14).
  return (
    <View style={styles.centered}>
      <Confetti />
      <View style={styles.successRing}>
        <CheckIcon size={28} color={color.success} />
      </View>
      <Text style={styles.header}>You’re in</Text>
      <Text style={styles.footnote}>Paid {amount}. Your spot is confirmed.</Text>
    </View>
  );
}

function Failure({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.header}>Payment didn’t go through</Text>
      <Text style={styles.footnote}>{message ?? "You weren’t charged. Try again."}</Text>
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
