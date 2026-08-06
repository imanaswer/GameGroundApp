import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, Text, TextInput, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { RegisterSchema } from "@/api/schemas";
import { AppleButton, AuthShell, Divider, GoogleButton, SwitchLink } from "@/components/auth/AuthShell";
import { useHandoff } from "@/components/chrome";
import { FormError, PasswordRules, fieldErrorsFrom } from "@/components/auth/fields";
import { Button, Input } from "@/components/ds";
import { useAppleAvailable, useAuth, useGoogleLogin } from "@/hooks/useAuth";
import { color, space, type } from "@/lib/tokens";
import { dur, ease } from "@/theme/animations";
import { themed, useThemedStyles } from "@/theme/runtime";

const TERMS_URL = "https://www.gameground.net/terms";
const PRIVACY_URL = "https://www.gameground.net/privacy";

export default function Signup() {
  const styles = useThemedStyles(sheets);
  const router = useRouter();
  const { register, loginWithApple, status: authStatus } = useAuth();
  const { begin: beginHandoff } = useHandoff();
  /**
   * Two-step signup, ported from the source's Sign up 04→06 flow: email alone, then the rest.
   * Purely client-side sequencing of the SAME single /auth/register call — the source verifies the
   * address with an emailed code between the steps, which needs endpoints we do not have. So this
   * borrows the pacing, not the verification, and nothing is sent until step two completes.
   */
  const [step, setStep] = useState<"email" | "details" | "done">("email");
  /** +1 advancing, -1 going back — the panel slides in from the side you came from. */
  const [dir, setDir] = useState(1);
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

  /** Step one validates ONLY the email, using the same schema field the server will apply. */
  const advance = () => {
    const email = form.email.trim();
    const parsed = RegisterSchema.shape.email.safeParse(email);
    if (!parsed.success) return setFieldErrors({ email: parsed.error.issues[0].message });
    setFieldErrors({});
    setDir(1);
    setStep("details");
  };

  // Back steps WITHIN the form before leaving it, so a mistyped email is one tap away rather than
  // a full restart.
  const back = () => {
    if (step === "details") {
      setDir(-1);
      return setStep("email");
    }
    return router.canGoBack() ? router.back() : router.replace("/onboarding");
  };

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
      // The account exists and the session is live; the success screen is an acknowledgement, not
      // a gate. Source's Sign up 08.
      setStep("done");
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
      // No navigation here — the effect below drives every successful auth on this screen
      // through the same acknowledgement → loader → home sequence.
      .then(() => {})
      // ERR_REQUEST_CANCELED = user dismissed the native sheet — an intentional exit, not an error.
      .catch((e) => {
        if ((e as { code?: string })?.code !== "ERR_REQUEST_CANCELED") setFormError(e);
      })
      .finally(() => setAppleBusy(false));
  };

  /**
   * ANY successful auth on this screen enters the acknowledgement, whatever produced it.
   *
   * Email/password reaches it through `submit`, but Apple used to call `router.replace("/home")`
   * itself and Google never navigated at all — it relied on the entry route redirecting once the
   * status flipped. Both bypassed the success screen, which is why it appeared to be skipped even
   * after the entry-route fix. Keying off the auth status instead of the individual handlers means
   * a future sign-in path cannot silently opt out of the flow.
   */
  useEffect(() => {
    if (authStatus === "signedIn" && (step === "email" || step === "details")) setStep("done");
  }, [authStatus, step]);

  /**
   * Straight into the app, skipping account setup. The loader is raised first and lives above the
   * navigator, so replacing the route in the same handler is fine — the tabs mount behind it
   * (five mount at launch, Decision 17) instead of after it. Doing this inside the screen is what
   * failed before: the loader was a child of the very screen the navigation unmounted.
   */
  const enterApp = () => {
    beginHandoff();
    router.replace("/home");
  };

  /**
   * The signup path is the ONLY way into account setup (Decision 23) — it is a new-member flow,
   * so it hangs off the acknowledgement rather than off the auth status, which every login would
   * also satisfy. No loader here: setup raises it on the way out, and a loader between two
   * screens the user is already looking at would be a pause, not a cover.
   */
  const continueToSetup = () => router.replace("/setup");

  // Declared BEFORE the `done` early return: these are hooks, and a return above them makes
  // them conditional — React would tear down state the moment signup succeeded.
  const reducedMotion = useReducedMotion();
  const enter = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) {
      enter.value = 1;
      return;
    }
    // Restart from just-off-screen on every step change; `step` is the only trigger.
    enter.value = 0;
    enter.value = withTiming(1, { duration: dur.base, easing: ease.exit });
  }, [step, reducedMotion, enter]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    // Travel is deliberately short (STEP_SLIDE): this is one form changing its contents, not a
    // screen push. A full-width slide would claim more navigational weight than the step has.
    transform: [{ translateX: (1 - enter.value) * STEP_SLIDE * dir }],
  }));

  if (step === "done") {
    return (
      <AuthShell title="You have been signed in successfully." accent="" subtitle="" onBack={enterApp}>
        {/* Continue → account setup. Back is the way past it, straight into the app. */}
        <Button testID="signup-continue" title="Continue" onPress={continueToSetup} />
      </AuthShell>
    );
  }

  const onEmailStep = step === "email";

  return (
    <AuthShell
      title={onEmailStep ? "Enter your email" : "Now let's set up"}
      accent={onEmailStep ? "to join us." : "your account."}
      subtitle={
        onEmailStep
          ? "Find coaches, drop into games and camps near you in Kozhikode."
          : form.email.trim()
      }
      onBack={back}
    >

      <FormError error={formError} />
      <Animated.View style={panelStyle}>
        {onEmailStep ? (
          <Input
            ref={emailRef}
            testID="auth-email"
            label="Email"
            value={form.email}
            onChangeText={update("email")}
            error={fieldErrors.email}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            placeholder="you@email.com"
            returnKeyType="go"
            onSubmitEditing={advance}
          />
        ) : (
          <>
          <Input
            testID="signup-name"
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
            testID="signup-username"
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
            ref={passwordRef}
            testID="auth-password"
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
          <PasswordRules value={form.password} />
          </>
        )}

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

        {/* Two buttons rather than one with a computed testID: the E2E selector contract can only
            verify STATIC testIDs, and a ternary silently opts out of that check. */}
        {onEmailStep ? (
          <Button testID="signup-continue-email" title="Continue" onPress={advance} />
        ) : (
          <Button testID="auth-submit" title="Create account" onPress={submit} loading={busy} />
        )}
      </Animated.View>

      {onEmailStep && hasSocial && <Divider />}
      {onEmailStep && google.available && (
        <GoogleButton label="Sign up with Google" onPress={google.prompt} disabled={busy || appleBusy} />
      )}
      {onEmailStep && appleAvailable && <AppleButton label="Sign up with Apple" onPress={onApple} disabled={busy || appleBusy} />}

      <View style={styles.spacer} />
      <SwitchLink
        prompt="Already have an account?"
        action="Log in"
        onPress={() => router.replace("/login")}
      />
    </AuthShell>
  );
}

/** MOTION §2 — a step change inside one form, not a screen push. Short travel on purpose. */
const STEP_SLIDE = 28;

const sheets = themed(() => ({
  // Left-aligned like the source. Centred legal copy reads as a footer; theirs is part of the
  // form column, set flush with the fields above it.
  // No negative margin. It previously tucked upward by 4px, which was fine under a field and an
  // actual overlap once this sat under the Continue button.
  terms: { ...type.caption, color: color.dim, lineHeight: 16, marginBottom: space(4) },
  // Underlined black, as in every legal link in the source's frames. `primarySoft` grey with no
  // underline did not read as tappable at all.
  termsLink: { color: color.text, textDecorationLine: "underline" },
  spacer: { flex: 1, minHeight: space(6) },
}));
