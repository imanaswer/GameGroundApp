import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { RegisterSchema } from "@/api/schemas";
import { AppleButton, AuthShell, Divider, GoogleButton, SwitchLink } from "@/components/auth/AuthShell";
import { FormError, fieldErrorsFrom } from "@/components/auth/fields";
import { Button, Input } from "@/components/ds";
import { useAppleAvailable, useAuth, useGoogleLogin } from "@/hooks/useAuth";
import { color, space, type } from "@/lib/tokens";

const TERMS_URL = "https://www.gameground.net/terms";
const PRIVACY_URL = "https://www.gameground.net/privacy";

export default function Signup() {
  const router = useRouter();
  const { register, loginWithApple } = useAuth();
  const [form, setForm] = useState({ name: "", username: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);

  const google = useGoogleLogin(setFormError);
  const appleAvailable = useAppleAvailable();
  const hasSocial = google.available || appleAvailable;

  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  // Update a field and clear its error as the user fixes it (the red line shouldn't linger).
  const update = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace("/onboarding"));

  const submit = async () => {
    setFormError(null);
    const parsed = RegisterSchema.safeParse({
      ...form,
      name: form.name.trim(),
      username: form.username.trim(),
      email: form.email.trim(),
    });
    if (!parsed.success) {
      const flat: Record<string, string> = {};
      for (const issue of parsed.error.issues) flat[String(issue.path[0])] = issue.message;
      return setFieldErrors(flat);
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await register(parsed.data);
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
      // ERR_REQUEST_CANCELED = user dismissed the native sheet — an intentional exit, not an error.
      .catch((e) => {
        if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") setFormError(e);
      })
      .finally(() => setAppleBusy(false));
  };

  return (
    <AuthShell
      title="Create your"
      accent="account"
      subtitle="Find coaches, drop into games and camps near you in Kozhikode."
      onBack={back}
    >
      {google.available && (
        <GoogleButton label="Sign up with Google" onPress={google.prompt} disabled={busy || appleBusy} />
      )}
      {appleAvailable && <AppleButton label="Sign up with Apple" onPress={onApple} disabled={busy || appleBusy} />}
      {hasSocial && <Divider />}

      <FormError error={formError} />
      <Input
        label="Full name"
        value={form.name}
        onChangeText={update("name")}
        error={fieldErrors.name}
        autoComplete="name"
        textContentType="name"
        placeholder="Ananya Suresh"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <Input
        ref={usernameRef}
        label="Username"
        value={form.username}
        onChangeText={update("username")}
        error={fieldErrors.username}
        hint="Lowercase letters, numbers and underscores."
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        placeholder="ananya_s"
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <Input
        ref={emailRef}
        label="Email"
        value={form.email}
        onChangeText={update("email")}
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
        label="Password"
        value={form.password}
        onChangeText={update("password")}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="At least 8 characters"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <Button title="Create account" onPress={submit} loading={busy} />
      <Text style={styles.terms}>
        By continuing you agree to our{" "}
        <Text accessibilityRole="link" style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </Text>{" "}
        &{" "}
        <Text accessibilityRole="link" style={styles.termsLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
        .
      </Text>

      <View style={styles.spacer} />
      <SwitchLink
        prompt="Already have an account?"
        action="Log in"
        onPress={() => router.replace("/login")}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  terms: { ...type.caption, color: color.dim2, textAlign: "center", lineHeight: 16, marginTop: space(3.5) },
  termsLink: { color: color.redLight },
  spacer: { flex: 1, minHeight: space(6) },
});
