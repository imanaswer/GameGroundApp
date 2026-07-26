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
    // Universal Links (M13). Requires the matching apple-app-site-association on the web repo
    // (public/.well-known/, appID = TEAMID.net.gameground.app). See docs/DEEP_LINKS_WEB.md.
    associatedDomains: ["applinks:www.gameground.net", "applinks:gameground.net"],
  },
  android: {
    package: variant.id,
    adaptiveIcon: {
      backgroundColor: "#050505",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // App Links (M13). autoVerify pairs with assetlinks.json (release SHA256) on the web repo.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/games" },
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/coaches" },
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/camps" },
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/workshops" },
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/events" },
          { scheme: "https", host: "www.gameground.net", pathPrefix: "/leaderboard" },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-apple-authentication",
    ["expo-splash-screen", { backgroundColor: "#050505", image: "./assets/images/splash-icon.png", imageWidth: 76 }],
    // Push (M12): brand-red accent + monochrome icon; the plugin adds the iOS APNs entitlement
    // and Android POST_NOTIFICATIONS permission at build time.
    ["expo-notifications", { color: "#e63946", icon: "./assets/images/android-icon-monochrome.png" }],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: profile,
    sentryDsn: process.env.SENTRY_DSN ?? null,
    // Only include the EAS block once a project id exists — EAS rejects a null projectId and
    // will populate it on `eas init`. Set EAS_PROJECT_ID (or hardcode the string) after linking.
    ...(process.env.EAS_PROJECT_ID
      ? { eas: { projectId: process.env.EAS_PROJECT_ID } }
      : {}),
  },
};

export default config;
