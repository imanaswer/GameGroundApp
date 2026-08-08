import Constants from "expo-constants";

/**
 * Env access point (Developer PRD §2.4). Injected by EAS build profiles.
 * Fails loudly at import time rather than producing a request to `undefined/api/...`.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name} — check eas.json / .env`);
  return value;
}

/**
 * Read a string out of `expoConfig.extra`, narrowing rather than asserting.
 *
 * `extra` is whatever `app.config.js` put in the manifest — it is untyped, and a cast like
 * `as string | null` is a promise TypeScript cannot keep. Asserting it shipped a launch-time
 * `raw?.trim is not a function`: optional chaining guards null and undefined only, so any other
 * non-string went straight through `?.` and died on the method call. Narrow at the boundary once,
 * and every consumer downstream gets the type it was told it would get.
 */
function extraString(key: string): string | null {
  const value = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" ? value : null;
}

export const env = {
  appEnv: (extraString("appEnv") ?? "development") as "development" | "preview" | "production",
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
  /**
   * **The app holds no gateway credential, by design.** Razorpay's publishable key arrives inside
   * each server-issued order (`CreatedOrder.keyId`) and is handed straight to checkout.js, so the
   * key in use is always the one the server actually created the order with. A second copy in the
   * app could only ever disagree with it — and would need a rebuild to rotate.
   *
   * This field is kept, always `""`, purely so the shape stays stable for the test mocks that
   * spread `env`. Nothing reads it. The credentials that matter are `RAZORPAY_KEY_ID` and
   * `RAZORPAY_KEY_SECRET` in the SERVER's environment; `EXPO_PUBLIC_RAZORPAY_KEY_ID` was never
   * wired to anything and setting it changes nothing.
   */
  razorpayKeyId: "",
  // No Google client ids here by design (§5.2 scope change): the app reuses the website's OAuth
  // client through a browser handoff, so there is nothing app-side left to configure.
  /**
   * Sign in with Apple (Decision 29, polarity per Decision 31). Not a preference — an **iOS
   * submission requirement**. Guideline 4.8 says an app using a third-party login to establish the
   * primary account (it names Google Sign-In) must ALSO offer a login service that limits
   * collection to name and email and lets the user keep that email private. Email/password fails
   * the second criterion, and the "exclusively your own account system" exemption is void while
   * Google is offered.
   *
   * **Opt-OUT, not opt-in**, and the polarity is the whole point. Written as `=== "true"` this
   * defaulted to *off*, so any environment that had not been told about the flag — a fresh clone, a
   * local `.env`, a CI job — silently built the App Store rejection. That is backwards for a
   * requirement: forgetting a setting should not be the same as declining to comply.
   *
   * Set `EXPO_PUBLIC_APPLE_AUTH_ENABLED=false` to build without it, which is a deliberate act with
   * a known consequence. `eas.json` still sets `"true"` explicitly in all three profiles — a no-op
   * now, kept because it documents the intent where a reader looks for build config.
   *
   * The runtime gates in `useAppleAvailable` (iOS + `isAvailableAsync()`) are what actually keep a
   * dead button off the screen, so defaulting on cannot surface one that doesn't work.
   */
  appleAuthEnabled: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED !== "false",
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  // Narrowed, not asserted — see extraString. Shape validation lives in lib/sentry.ts.
  sentryDsn: extraString("sentryDsn"),
} as const;
