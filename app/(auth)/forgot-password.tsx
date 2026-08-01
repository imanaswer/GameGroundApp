import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import * as authApi from "@/api/auth";
import { LoginSchema } from "@/api/schemas";
import { AuthShell, SwitchLink } from "@/components/auth/AuthShell";
import { FormError } from "@/components/auth/fields";
import { Button, CheckIcon, Input } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import { color, radius, space, type } from "@/lib/tokens";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/login"));

  const submit = async () => {
    setFormError(null);
    const parsed = LoginSchema.shape.email.safeParse(email.trim());
    if (!parsed.success) return setFieldError(parsed.error.issues[0]?.message);
    setFieldError(undefined);
    setBusy(true);
    try {
      await authApi.forgotPassword(parsed.data);
      setSent(true);
    } catch (e) {
      setFormError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your"
      accent="password"
      subtitle="Enter your email and we’ll send you a link to set a new one."
      onBack={back}
    >
      {sent ? (
        <View style={styles.doneCard}>
          <View style={styles.doneIcon}>
            <CheckIcon size={20} color={color.success} />
          </View>
          <Text style={styles.doneTitle}>Check your inbox</Text>
          <Text style={styles.doneBody}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
          <Press accessibilityRole="button" tilt={false} onPress={submit} disabled={busy} style={styles.resend}>
            <Text style={styles.resendText}>{busy ? "Resending…" : "Didn’t get it? Resend"}</Text>
          </Press>
        </View>
      ) : (
        <>
          <FormError error={formError} />
          <Input
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (fieldError) setFieldError(undefined);
            }}
            error={fieldError}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            placeholder="you@email.com"
            returnKeyType="send"
            onSubmitEditing={submit}
          />
          <Button title="Send reset link" onPress={submit} loading={busy} />
        </>
      )}

      <View style={styles.spacer} />
      <SwitchLink prompt="Remembered it?" action="Back to log in" onPress={() => router.replace("/login")} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  doneCard: {
    alignItems: "center",
    gap: space(3),
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.card,
    paddingVertical: space(8),
    paddingHorizontal: space(6),
  },
  doneIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color.successSurface,
  },
  doneTitle: { ...type.heading, color: color.text },
  doneBody: { ...type.body, lineHeight: 20, color: color.dim, textAlign: "center" },
  resend: { marginTop: space(1) },
  resendText: { ...type.bodyStrong, color: color.redLight },
  spacer: { flex: 1, minHeight: space(6) },
});
