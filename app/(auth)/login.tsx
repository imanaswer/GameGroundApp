import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { LoginSchema } from "@/api/schemas";
import { FormError, fieldErrorsFrom } from "@/components/auth/fields";
import { Screen } from "@/components/chrome/Screen";
import { Button, Input } from "@/components/ds";
import { useAppleAvailable, useAuth, useGoogleLogin } from "@/hooks/useAuth";
import { color, space, type } from "@/lib/tokens";

export default function Login() {
  const router = useRouter();
  const { login, loginWithApple } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const google = useGoogleLogin(setFormError);
  const appleAvailable = useAppleAvailable();

  const submit = async () => {
    setFormError(null);
    const parsed = LoginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0])] = issue.message;
      return setFieldErrors(flat);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await login(parsed.data.email, parsed.data.password);
      router.replace("/home");
    } catch (e) {
      const inline = fieldErrorsFrom(e);
      if (Object.keys(inline).length) setFieldErrors(inline);
      else setFormError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Log in to find your next game.</Text>

          <FormError error={formError} />
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
          />
          <Button title="Log in" onPress={submit} loading={busy} />

          <Link href="/forgot-password" style={styles.link}>
            Forgot password?
          </Link>

          {(google.available || appleAvailable) && (
            <View style={styles.social}>
              {google.available && (
                <Button title="Continue with Google" variant="secondary" onPress={google.prompt} />
              )}
              {appleAvailable && (
                <Button
                  title="Continue with Apple"
                  variant="secondary"
                  onPress={() => {
                    loginWithApple()
                      .then(() => router.replace("/home"))
                      // Code 1001 = user dismissed the native sheet — an intentional exit, not an error.
                      .catch((e) => {
                        if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") setFormError(e);
                      });
                  }}
                />
              )}
            </View>
          )}

          <Text style={styles.footer}>
            New here?{" "}
            <Link href="/signup" style={styles.footerLink}>
              Create an account
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingVertical: space(8) },
  title: { ...type.title1, color: color.text, marginBottom: space(2) },
  sub: { ...type.body, color: color.dim, marginBottom: space(7) },
  link: { ...type.bodyStrong, color: color.redLight, textAlign: "center", marginTop: space(4) },
  social: { marginTop: space(6), gap: space(3) },
  footer: { ...type.body, color: color.dim, textAlign: "center", marginTop: space(8) },
  footerLink: { color: color.redLight, fontFamily: type.bodyStrong.fontFamily },
});
