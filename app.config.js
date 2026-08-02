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
    // Monochrome launch: white mark on the near-black field, no brand red (decision 18).
    // backgroundColor stays `color.bg` (#050505) rather than pure #000 so the handoff from the
    // native splash to the first React screen is seamless — a #000 splash against a #050505 app
    // shows a visible step at the exact moment the splash fades out.
    //
    // Mark width: 140pt, putting the artwork at ~28.5% of a 393pt screen.
    // Deliberately BELOW the reference screenshot's 33.5%, which measured out to imageWidth 170.
    // Matching that number matched the wrong thing: the reference mark is a thin ribbon, ours is a
    // solid arrow, so at equal bounding-box width ours carries far more visual mass and reads
    // oversized. 140 matches the reference's optical weight rather than its measurements — chosen
    // from a side-by-side render of 170/140/120/100.
    // `imageWidth` sizes the whole square canvas, NOT the artwork inside it — this asset's alpha
    // bbox is only 818/1024 = 79.9% of its canvas, so the two are not interchangeable.
    // Android keeps the established 0.714 ratio against iOS: Android 12+ owns its splash (system
    // SplashScreen API — centred icon, outer third masked off) and a value that survives that mask
    // is not the same value that looks right on iOS.
    // imageWidth is fixed pt, so the ratio drifts a little across screen widths (≈35% at 375pt,
    // ≈31% at 430pt). Percentage sizing is not expressible in this plugin.
    [
      "expo-splash-screen",
      {
        backgroundColor: "#050505",
        image: "./assets/images/splash-icon.png",
        imageWidth: 140,
        resizeMode: "contain",
        android: { imageWidth: 100 },
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
