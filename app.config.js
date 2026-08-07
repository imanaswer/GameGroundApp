/**
 * Env-driven Expo config (Developer PRD §2.4). Plain JS (not .ts) so every toolchain —
 * including the global eas-cli on newer Node versions — reads it without a TypeScript transpile
 * step. Only EXPO_PUBLIC_* values reach the bundle; SENTRY_DSN lands in `extra`, never in source.
 *
 * Before every release cut: scripts/release-check.sh (export + secret grep).
 */
const profile = process.env.APP_ENV ?? "development";

// The home-screen name is "GameGround"; the dev/preview suffixes stay so two installed builds are
// still tellable apart. The IDs and `scheme` below carry the fork identity instead — they must keep
// differing from the original app's, whatever the display name says.
const variant = {
  development: { name: "GameGround (Dev)", id: "net.gameground.redesigned.dev" },
  preview: { name: "GameGround (Preview)", id: "net.gameground.redesigned.preview" },
  production: { name: "GameGround", id: "net.gameground.redesigned" },
}[profile];

/**
 * A Sentry DSN is `https://<key>@<host>/<numeric project id>`. MUST stay in step with `usableDsn`
 * in src/lib/tokens' sibling `src/lib/sentry.ts` — this file is CommonJS and cannot import it, so
 * `__tests__/sentry-init.test.ts` asserts the two agree rather than trusting they do.
 */
const DSN_SHAPE = /^https?:\/\/[^\s:@/]+(?::[^\s@/]+)?@[^\s/]+\/\d+$/;

/**
 * Placeholder DSNs count as unset. `.env` ships `SENTRY_DSN=https://...@sentry.io/...` (the repo
 * convention for an unconfigured secret, cf. `rzp_test_replace_me`), and a truthiness check let
 * that through — arming the config plugin, i.e. the native auto-init this gate exists to prevent,
 * on every developer machine that had never configured Sentry at all.
 */
const rawSentryDsn = (process.env.SENTRY_DSN ?? "").trim();
const sentryDsn = DSN_SHAPE.test(rawSentryDsn) ? rawSentryDsn : null;
if (rawSentryDsn && !sentryDsn && !globalThis.__ggWarnedSentryDsn) {
  // Expo evaluates this config many times per start (manifest, prebuild, each platform request),
  // so an unguarded warn prints ten-plus times and buries the rest of the startup log.
  globalThis.__ggWarnedSentryDsn = true;
  console.warn("[app.config] SENTRY_DSN is set but is not a valid DSN — treating Sentry as disabled.");
}

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
 * empty DSN reaching `SentrySDKWrapper setupWithDictionary`. Gating the plugin on a VALID
 * SENTRY_DSN makes that configuration unreachable by construction: no usable DSN, no plugin, no
 * native init, no crash. "Valid" is load-bearing — see the note on DSN_SHAPE above.
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
  // device makes which one opens a deep link undefined. This is also the scheme the Google browser
  // handoff returns to (§5.2), so it needs no companion: the bundle-id scheme the native OAuth
  // flow would have required is deliberately absent, which is what keeps that flow rebuild-free.
  scheme: "ggredesign",
  /**
   * Decision 24 — there IS a dark variant now, so this is "automatic".
   *
   * This is not cosmetic: on iOS it writes `UIUserInterfaceStyle` into Info.plist, and while it
   * said "light" the OS reported light to `useColorScheme()` no matter what the phone was set to.
   * The app's own "System" option would have been permanently stuck on light with nothing in the
   * JS to explain why. **Takes a native rebuild** — a JS reload cannot change Info.plist.
   *
   * `backgroundColor` is the window behind the app, seen during rotation and push transitions. It
   * cannot follow a runtime theme either, so it stays the light page: it is visible for
   * milliseconds, and a black flash on the light theme is more jarring than the reverse.
   */
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFFFFF",
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
    // Sign in with Apple (Decision 29). The plugin adds the iOS entitlement; without it
    // `signInAsync` throws at runtime. Unconditional on purpose — guideline 4.8 makes this a
    // submission requirement while Google is offered, not an optional extra. The runtime gate
    // is EXPO_PUBLIC_APPLE_AUTH_ENABLED (see src/lib/env.ts), and it is Android-inert.
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
    /**
     * THIS app's own EAS project (`@sarangs1621/redesigned-gameground`), created 7 Aug 2026.
     *
     * The id that used to be forbidden here was the ORIGINAL app's — inheriting it would have
     * pointed this project's builds and any future OTA channel at another app entirely. That
     * hazard is gone now that this app owns a project; the value below is its own.
     *
     * `EAS_PROJECT_ID` still wins when set, so a fork or a second environment can retarget builds
     * without editing this file.
     */
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "9a033e8c-b3e7-4c09-95d9-a0306947e718" },
  },
};
