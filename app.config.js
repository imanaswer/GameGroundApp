/**
 * Env-driven Expo config (Developer PRD §2.4). Plain JS (not .ts) so every toolchain —
 * including the global eas-cli on newer Node versions — reads it without a TypeScript transpile
 * step. Only EXPO_PUBLIC_* values reach the bundle; SENTRY_DSN lands in `extra`, never in source.
 *
 * Before every release cut: scripts/release-check.sh (export + secret grep).
 */
const profile = process.env.APP_ENV ?? "development";

const variant = {
  development: { name: "GG Redesign (Dev)", id: "net.gameground.redesigned.dev" },
  preview: { name: "GG Redesign (Preview)", id: "net.gameground.redesigned.preview" },
  production: { name: "GG Redesign", id: "net.gameground.redesigned" },
}[profile];

const sentryDsn = process.env.SENTRY_DSN ?? null;

const canResolve = (id) => {
  try {
    require.resolve(id);
    return true;
  } catch {
    return false;
  }
};

/**
 * Crash reporting (§13) — enabled ONLY when a DSN is set AND the package resolves.
 *
 * Commit 4e8c579: `@sentry/react-native` 7.11's native Expo auto-init threw
 * NSInvalidArgumentException at launch *while `extra.sentryDsn` was null* — the signature of an
 * empty DSN reaching `SentrySDKWrapper setupWithDictionary`. Gating the plugin on SENTRY_DSN makes
 * that configuration unreachable by construction: no DSN, no plugin, no native init, no crash.
 *
 * To turn it on: create the Sentry project, `npx expo install @sentry/react-native`, then set
 * SENTRY_DSN (+ SENTRY_ORG / SENTRY_PROJECT for source-map upload, and SENTRY_AUTH_TOKEN at build
 * time — without the token the plugin warns and skips the upload rather than failing the build).
 */
const sentryPlugin = (() => {
  if (!sentryDsn) return [];
  // Config-plugin entry point for RN SDK 5+; the bare package name is not a plugin.
  if (!canResolve("@sentry/react-native/expo")) {
    console.warn(
      "[app.config] SENTRY_DSN is set but @sentry/react-native is not installed — " +
        "skipping the Sentry plugin. Run: npx expo install @sentry/react-native",
    );
    return [];
  }
  return [
    [
      "@sentry/react-native/expo",
      {
        url: process.env.SENTRY_URL ?? "https://sentry.io/",
        ...(process.env.SENTRY_ORG ? { organization: process.env.SENTRY_ORG } : {}),
        ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
      },
    ],
  ];
})();

module.exports = {
  name: variant.name,
  slug: "redesigned-gameground",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  // Distinct from the original's "gameground://" — two apps registering the same scheme on one
  // device makes which one opens a deep link undefined.
  scheme: "ggredesign",
  userInterfaceStyle: "dark",
  backgroundColor: "#050505",
  // EAS Update is deliberately NOT configured. This project shares no OTA channel with the
  // original: inheriting its `updates.url` + projectId would push the ORIGINAL app's JS bundle
  // onto this one. Run `eas init` (then re-add `updates`) when this app needs its own project.
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
    // Splash mark sized to fill the screen as far as each platform allows.
    // iOS 280pt ≈ 70% of a 390pt-wide device; at @3x that is 840px from a 1024px source, so it
    // still never upscales. Android 12+ owns its splash (system SplashScreen API: centred icon,
    // outer third masked off, solid background — a full-bleed image is not expressible), so it
    // gets a smaller value that survives the mask instead of being clipped.
    // A genuinely edge-to-edge iOS splash would need portrait artwork (~1284×2778) plus
    // resizeMode:"cover"; the current asset is a 1024² mark and would crop badly.
    [
      "expo-splash-screen",
      {
        backgroundColor: "#050505",
        image: "./assets/images/splash-icon.png",
        imageWidth: 280,
        resizeMode: "contain",
        android: { imageWidth: 200 },
      },
    ],
    // Push (M12): brand-red accent + monochrome icon; the plugin adds the iOS APNs entitlement
    // and Android POST_NOTIFICATIONS permission at build time.
    ["expo-notifications", { color: "#e63946", icon: "./assets/images/android-icon-monochrome.png" }],
    // Crash reporting — see `sentryPlugin` above. Empty unless SENTRY_DSN is set.
    ...sentryPlugin,
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: profile,
    sentryDsn,
    // No hardcoded projectId — that id belongs to the original app's EAS project. `eas init` will
    // write a new one here; until then only EAS_PROJECT_ID from the env applies.
    ...(process.env.EAS_PROJECT_ID ? { eas: { projectId: process.env.EAS_PROJECT_ID } } : {}),
  },
};
