import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { LoginSchema } from "@/api/schemas";
import { AppleButton, AuthShell, Divider, GoogleButton, SwitchLink } from "@/components/auth/AuthShell";
import { FormError, fieldErrorsFrom } from "@/components/auth/fields";
import { Button, Input } from "@/components/ds";
import { Press } from "@/components/ds/Press";
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
  const [appleBusy, setAppleBusy] = useState(false);

  const google = useGoogleLogin(setFormError);
  const appleAvailable = useAppleAvailable();
  const hasSocial = google.available || appleAvailable;

  const passwordRef = useRef<TextInput>(null);
  // Clear a field's error the moment the user starts fixing it, so the red line never
  // contradicts the value being typed.
  const clearError = (k: string) => setFieldErrors((e) => (e[k] ? { ...e, [k]: "" } : e));

  const back = () => (router.canGoBack() ? router.back() : router.replace("/onboarding"));

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

  const onApple = () => {
    if (appleBusy) return;
    setAppleBusy(true);
    loginWithApple()
      .then(() => router.replace("/home"))
      // Code ERR_REQUEST_CANCELED = user dismissed the native sheet — an intentional exit, not an error.
      .catch((e) => {
        if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") setFormError(e);
      })
      .finally(() => setAppleBusy(false));
  };

  return (
    <AuthShell
      title="Welcome"
      accent="back"
      subtitle="Log in to pick up right where you left off."
      onBack={back}
    >
      {google.available && (
        <GoogleButton label="Continue with Google" onPress={google.prompt} disabled={busy || appleBusy} />
      )}
      {appleAvailable && <AppleButton label="Continue with Apple" onPress={onApple} disabled={busy || appleBusy} />}
      {hasSocial && <Divider />}

      <FormError error={formError} />
      <Input
        testID="auth-email"
        label="Email"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          clearError("email");
        }}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        placeholder="you@email.com"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Input
        ref={passwordRef}
        testID="auth-password"
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clearError("password");
        }}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        placeholder="Your password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Press
        accessibilityRole="link"
        tilt={false}
        onPress={() => router.push("/forgot-password")}
        style={styles.forgot}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Press>

      <Button testID="auth-submit" title="Log in" onPress={submit} loading={busy} />

      <View style={styles.spacer} />
      <SwitchLink
        prompt="New to GameGround?"
        action="Create account"
        onPress={() => router.replace("/signup")}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  forgot: { alignSelf: "flex-end", marginTop: -space(2), marginBottom: space(4) },
  forgotText: { ...type.bodyStrong, color: color.dim },
  spacer: { flex: 1, minHeight: space(6) },
});
