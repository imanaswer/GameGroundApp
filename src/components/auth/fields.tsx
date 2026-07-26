/**
 * Auth-form logic helpers. The visual primitives moved to the DS in M3 (Input, Button);
 * what remains here is error mapping — server 422 details → field errors, 429 → countdown.
 */
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { ApiClientError } from "@/api/client";
import { color, space, type } from "@/lib/tokens";

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
  formError: { ...type.bodyStrong, color: color.redLight, marginBottom: space(3), textAlign: "center" },
});
