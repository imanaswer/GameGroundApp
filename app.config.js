/**
 * Env-driven Expo config (Developer PRD §2.4). Plain JS (not .ts) so every toolchain —
 * including the global eas-cli on newer Node versions — reads it without a TypeScript transpile
 * step. Only EXPO_PUBLIC_* values reach the bundle; SENTRY_DSN lands in `extra`, never in source.
 *
 * Before every release cut: scripts/release-check.sh (export + secret grep).
 */
const profile = process.env.APP_ENV ?? "development";

const variant = {
  development: { name: "Game Ground (Dev)", id: "net.gameground.app.dev" },
  preview: { name: "Game Ground (Preview)", id: "net.gameground.app.preview" },
  production: { name: "Game Ground", id: "net.gameground.app" },
}[profile];

module.exports = {
  name: variant.name,
  slug: "gameground-mobile",
  owner: "imanaswer",
  version: "1.0.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "gameground",
  userInterfaceStyle: "dark",
  backgroundColor: "#050505",
  // EAS Update (OTA). runtimeVersion tracks app version so OTA never crosses a native change.
  updates: { url: "https://u.expo.dev/c51e7b53-2f3f-4556-b1c7-4e539836f90a" },
  runtimeVersion: { policy: "appVersion" },
  ios: {
    bundleIdentifier: variant.id,
    supportsTablet: false,
    // Uses only standard/exempt encryption (HTTPS) — skips the export-compliance prompt.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
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
    // Crash reporting (§13) — DISABLED. The @sentry/react-native config plugin is intentionally
    // omitted: the package isn't installed and its native auto-init threw an NSException on launch
    // (commit 4e8c579). Re-enabling means: `npx expo install @sentry/react-native`, resolving the
    // launch crash, then restoring the ["@sentry/react-native", { url, organization, project }] entry.
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: profile,
    sentryDsn: process.env.SENTRY_DSN ?? null,
    // Linked EAS project (eas init). Env override kept for CI / alternate accounts.
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "c51e7b53-2f3f-4556-b1c7-4e539836f90a" },
  },
};
