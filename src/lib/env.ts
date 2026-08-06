import Constants from "expo-constants";

/**
 * Env access point (Developer PRD §2.4). Injected by EAS build profiles.
 * Fails loudly at import time rather than producing a request to `undefined/api/...`.
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name} — check eas.json / .env`);
  return value;
}

export const env = {
  appEnv: (Constants.expoConfig?.extra?.appEnv ?? "development") as
    | "development"
    | "preview"
    | "production",
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL),
  razorpayKeyId: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "",
  // No Google client ids here by design (§5.2 scope change): the app reuses the website's OAuth
  // client through a browser handoff, so there is nothing app-side left to configure.
  /**
   * Apple sign-in stays behind an explicit flag rather than device capability alone. Unlike Google
   * there is no client id here that can be implicitly missing, so without this the button would
   * render on every iPhone — including against a deployment where `APPLE_BUNDLE_IDS` is unset and
   * `POST /auth/apple/mobile` answers 503. Flip to "true" only once the server has that variable.
   */
  appleAuthEnabled: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true",
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  sentryDsn: (Constants.expoConfig?.extra?.sentryDsn ?? null) as string | null,
} as const;
