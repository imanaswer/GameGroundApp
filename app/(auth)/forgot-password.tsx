import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import * as authApi from "@/api/auth";
import { LoginSchema } from "@/api/schemas";
import { Field, FormButton, FormError } from "@/components/auth/fields";
import { Screen } from "@/components/chrome/Screen";
import { color, space, type } from "@/lib/tokens";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

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
    <Screen>
      <Text style={styles.title}>Reset password</Text>
      {sent ? (
        <>
          <Text style={styles.sub}>
            If an account exists for {email.trim()}, a reset link is on its way. Check your inbox.
          </Text>
          <Link href="/login" style={styles.link}>
            Back to log in
          </Link>
        </>
      ) : (
        <>
          <Text style={styles.sub}>Enter your email and we’ll send you a reset link.</Text>
          <FormError error={formError} />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={fieldError}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <FormButton title="Send reset link" onPress={submit} loading={busy} />
          <Link href="/login" style={styles.link}>
            Back to log in
          </Link>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title1, color: color.text, marginTop: space(10), marginBottom: space(2) },
  sub: { ...type.body, color: color.dim, marginBottom: space(7) },
  link: { ...type.bodyStrong, color: color.redLight, textAlign: "center", marginTop: space(5) },
});
