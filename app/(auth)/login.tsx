import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { LoginSchema } from "@/api/schemas";
import { AppleButton, AuthShell, Divider, GoogleButton, SwitchLink } from "@/components/auth/AuthShell";
import { FormError, fieldErrorsFrom } from "@/components/auth/fields";
import { useHandoff } from "@/components/chrome";
import { Button, Input } from "@/components/ds";
import { Press } from "@/components/ds/Press";
import { useAppleAvailable, useAuth, useGoogleLogin } from "@/hooks/useAuth";
import { postAuthDestination } from "@/lib/postAuthRoute";
import { color, space, type } from "@/lib/tokens";
import { themed, useThemedStyles } from "@/theme/runtime";

export default function Login() {
  const styles = useThemedStyles(sheets);
  const router = useRouter();
  const { login, loginWithApple, status: authStatus, isNewAccount } = useAuth();
  const { begin: beginHandoff } = useHandoff();
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

  /**
   * ANY successful sign-in on this screen leaves through the brand loader, whatever produced it —
   * email/password or Google (whose hook never navigates at all; it relies on the status
   * flipping). Keying off the status rather than the individual handlers is what stops a path
   * from silently opting out of the handoff, which is exactly how Google skipped signup's
   * success screen.
   *
   * `begin()` raises the loader ABOVE the navigator, so replacing the route in the same commit is
   * fine — and wanted. The tabs mount behind the loader instead of after it.
   */
  useEffect(() => {
    if (authStatus !== "signedIn") return;
    // A social sign-in on THIS screen can still have created the account — the routes
    // create-or-find. When the server says so, send them to setup like any other new member
    // (Decision 32). It says nothing today, so this stays the straight-to-home path it was.
    if (postAuthDestination({ screen: "login", isNewAccount }) === "setup") {
      router.replace("/setup"); // setup raises the loader on its own way out
      return;
    }
    beginHandoff();
    router.replace("/home");
  }, [authStatus, isNewAccount, beginHandoff, router]);

  /**
   * Sign in with Apple (Decision 29). No navigation here either — the effect above drives every
   * successful sign-in through the loader, and Apple is not allowed to be the one path that skips it.
   *
   * ERR_REQUEST_CANCELED is the user dismissing the native sheet. That is an intentional exit, so
   * it must not surface as an error; every other code is a real failure and does.
   */
  const onApple = () => {
    if (appleBusy) return;
    setAppleBusy(true);
    loginWithApple()
      .catch((e) => {
        if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") setFormError(e);
      })
      .finally(() => setAppleBusy(false));
  };

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
      // No navigation here — the effect above drives every successful sign-in through the loader.
      await login(parsed.data.email, parsed.data.password);
    } catch (e) {
      const inline = fieldErrorsFrom(e);
      if (Object.keys(inline).length) setFieldErrors(inline);
      else setFormError(e);
    } finally {
      setBusy(false);
    }
  };


  return (
    <AuthShell
      title="Welcome"
      accent="back"
      subtitle="Log in to pick up right where you left off."
      onBack={back}
    >

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

      {hasSocial && <Divider />}
      {/* Apple first on iOS: 4.8 wants an "equivalent option", and equivalence is read as
          prominence too, not just presence. It renders only on iOS, so Google leads on Android. */}
      {appleAvailable && (
        <AppleButton label="Continue with Apple" onPress={onApple} disabled={busy || appleBusy} />
      )}
      {google.available && (
        <GoogleButton label="Continue with Google" onPress={google.prompt} disabled={busy || appleBusy} />
      )}

      <View style={styles.spacer} />
      <SwitchLink
        prompt="New to GameGround?"
        action="Create account"
        onPress={() => router.replace("/signup")}
      />
    </AuthShell>
  );
}

const sheets = themed(() => ({
  forgot: { alignSelf: "flex-end", marginTop: -space(2), marginBottom: space(4) },
  forgotText: { ...type.bodyStrong, color: color.dim },
  spacer: { flex: 1, minHeight: space(6) },
}));
