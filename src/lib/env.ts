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
  posthogKey: process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "",
  sentryDsn: (Constants.expoConfig?.extra?.sentryDsn ?? null) as string | null,
} as const;
