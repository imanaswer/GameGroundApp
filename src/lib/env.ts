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
  // Native Google OAuth client ids (§5.2) — empty until created in Google Cloud Console.
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "",
  /**
   * Apple sign-in is gated OFF by default: `POST /auth/apple/mobile` is §5.2 server work that
   * hasn't shipped, and unlike Google there is no client-id to be implicitly missing — device
   * capability alone would render a button that always 404s. Flip this when the route is live.
   */
  appleAuthEnabled: process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true",
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  sentryDsn: (Constants.expoConfig?.extra?.sentryDsn ?? null) as string | null,
} as const;
