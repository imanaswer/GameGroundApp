/**
 * Auth-form logic helpers. The visual primitives moved to the DS in M3 (Input, Button);
 * what remains here is error mapping — server 422 details → field errors, 429 → countdown.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ApiClientError } from "@/api/client";
import { CheckIcon } from "@/components/ds";
import { color, ramp, space, type } from "@/lib/tokens";
import { themed, usePalette, useThemedStyles } from "@/theme/runtime";

/** Renders a thrown form error. 429s show a live countdown; everything else, the server string. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiClientError && error.status === 429)
    return <RateLimitCountdown seconds={error.retryAfterSec ?? 60} />;
  const message = error instanceof Error ? error.message : "Something went wrong";
  return <Text style={styles.formError}>{message}</Text>;
}

function RateLimitCountdown({ seconds }: { seconds: number }) {
  
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const timer = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : s)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text style={styles.formError}>
      {left > 0 ? `Too many attempts. Try again in ${left}s` : "You can try again now"}
    </Text>
  );
}

/** Pulls zod issues or server 422 `details` into a {field: message} map. */
export function fieldErrorsFrom(error: unknown): Record<string, string> {
  if (error instanceof ApiClientError && error.status === 422 && error.details) {
    const out: Record<string, string> = {};
    for (const [field, messages] of Object.entries(error.details)) {
      const first = Array.isArray(messages) ? messages[0] : messages;
      if (typeof first === "string") out[field] = first;
    }
    return out;
  }
  return {};
}

const styles = StyleSheet.create({
  // Error ramp, not `primarySoft` — the rename mapped this mechanically and a grey form error
  // does not read as a failure.
  formError: { ...type.bodyStrong, color: ramp.error[600], marginBottom: space(3), textAlign: "center" },
});

/**
 * Live password requirements, ported from the source's Sign up 07 frame — a checklist under the
 * password field that ticks green as each rule is satisfied.
 *
 * The source lists two rules ("minimum of 8 characters", "uppercase, lowercase and one number")
 * because that app enforces both. **We list only what our server actually enforces** — `RegisterSchema`
 * requires 8 characters and nothing more. Rendering their second rule would invent a constraint
 * the API does not apply: the user would be told their valid password is invalid, and a rule that
 * the server ignores is worse than no rule at all.
 *
 * Rules are declared here as data so adding one when the API adds one is a single line, not a
 * layout change.
 */
const PASSWORD_RULES: { label: string; test: (v: string) => boolean }[] = [
  { label: "Minimum of 8 characters", test: (v) => v.length >= 8 },
];

export function PasswordRules({ value }: { value: string }) {
  const ruleStyles = useThemedStyles(ruleSheets);
  const color = usePalette();
  return (
    <View style={ruleStyles.wrap}>
      {PASSWORD_RULES.map((r) => {
        const met = r.test(value);
        return (
          <View key={r.label} style={ruleStyles.row}>
            <CheckIcon size={13} color={met ? color.successText : color.dim2} />
            <Text style={[ruleStyles.label, met && ruleStyles.labelMet]}>{r.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const ruleSheets = themed(() => ({
  // Sits directly under the field, inside its bottom margin rather than adding to it.
  wrap: { marginTop: -space(2.5), marginBottom: space(4), gap: space(1) },
  row: { flexDirection: "row", alignItems: "center", gap: space(1.5) },
  label: { ...type.caption, color: color.dim2 },
  labelMet: { color: color.successText },
}));
