/**
 * M2 auth-form primitives, token-styled per the kit's GGAuth module.
 * M3 replaces these with the real DS Input/Button — keep the props identical.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

import { ApiClientError } from "@/api/client";
import { color, radius, space, type } from "@/lib/tokens";

type FieldProps = TextInputProps & { label: string; error?: string };

export function Field({ label, error, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={color.dim2}
        style={[styles.input, focused && styles.inputFocus, !!error && styles.inputError]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...input}
      />
      {!!error && <Text style={styles.errorLine}>{error}</Text>}
    </View>
  );
}

export function FormButton({
  title,
  onPress,
  loading = false,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        pressed && styles.buttonPressed,
        loading && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color.text} />
      ) : (
        <Text style={variant === "primary" ? styles.buttonText : styles.buttonTextSecondary}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Renders a thrown form error. 422 details are mapped by the caller into per-field errors;
 * everything else lands here — server `error` strings verbatim, 429s as a live countdown (§3.2).
 */
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
  fieldWrap: { marginBottom: space(4) },
  fieldLabel: { ...type.label, color: color.dim, marginBottom: space(2) },
  input: {
    backgroundColor: color.card,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: color.border,
    color: color.text,
    fontFamily: type.body.fontFamily,
    fontSize: 13.5,
    paddingHorizontal: space(3.5),
    paddingVertical: space(3),
    minHeight: 44,
  },
  inputFocus: { borderColor: color.redFocus },
  inputError: { borderColor: color.redLight },
  errorLine: { ...type.caption, color: color.redLight, marginTop: space(1) },
  button: {
    backgroundColor: color.red,
    borderRadius: 16,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space(3.5),
  },
  buttonSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: color.border2,
  },
  buttonPressed: { backgroundColor: color.redDeep, transform: [{ scale: 0.98 }] },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...type.heading, color: color.text },
  buttonTextSecondary: { ...type.heading, color: color.text },
  formError: { ...type.bodyStrong, color: color.redLight, marginBottom: space(3), textAlign: "center" },
});
