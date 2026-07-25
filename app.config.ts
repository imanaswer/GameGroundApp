import type { ExpoConfig } from "expo/config";

/**
 * Env-driven config (Developer PRD §2.4). Only EXPO_PUBLIC_* values reach the bundle;
 * SENTRY_DSN is read at build time and lands in `extra`, never in source.
 *
 * Before every release cut:
 *   npx expo export && grep -r "rzp_live\|AUTH_SECRET\|key_secret" dist/   # must be empty
 */
const profile = (process.env.APP_ENV ?? "development") as "development" | "preview" | "production";

const variant = {
  development: { name: "Game Ground (Dev)", id: "net.gameground.app.dev" },
  preview: { name: "Game Ground (Preview)", id: "net.gameground.app.preview" },
  production: { name: "Game Ground", id: "net.gameground.app" },
}[profile];

const config: ExpoConfig = {
  name: variant.name,
  slug: "gameground-mobile",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "gameground",
  userInterfaceStyle: "dark",
  backgroundColor: "#050505",
  ios: {
    bundleIdentifier: variant.id,
    supportsTablet: false,
    associatedDomains: ["applinks:www.gameground.net"],
  },
  android: {
    package: variant.id,
    adaptiveIcon: {
      backgroundColor: "#050505",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "www.gameground.net" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    ["expo-splash-screen", { backgroundColor: "#050505", image: "./assets/images/splash-icon.png", imageWidth: 76 }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: profile,
    sentryDsn: process.env.SENTRY_DSN ?? null,
    eas: { projectId: process.env.EAS_PROJECT_ID ?? null },
  },
};

export default config;
