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

/**
 * Android App Links (M13) — the host × path matrix, kept as data so the two host variants cannot
 * drift apart the way they had.
 *
 * iOS declared BOTH `www.gameground.net` and the apex `gameground.net` in `associatedDomains`,
 * while Android listed only `www`. A link to `https://gameground.net/games/<id>` therefore opened
 * the app on iOS and the browser on Android — and since the apex is what people type and what most
 * link shorteners emit, that is not an edge case.
 *
 * Android merges every `<data>` element inside one `<intent-filter>` into a cross product, so
 * listing each host once against each path prefix is equivalent to (and more legible than) a
 * hand-written matrix. `assetlinks.json` must be reachable on BOTH hosts for `autoVerify` to pass;
 * an apex that 301s to `www` does not count as served. See docs/DEEP_LINKS_WEB.md.
 */
const LINK_HOSTS = ["www.gameground.net", "gameground.net"];
const LINK_PATHS = ["/games", "/coaches", "/camps", "/workshops", "/events", "/leaderboard"];
const APP_LINK_DATA = LINK_HOSTS.flatMap((host) =>
  LINK_PATHS.map((pathPrefix) => ({ scheme: "https", host, pathPrefix })),
);

module.exports = {
  name: variant.name,
  // Pins the EAS account. Without it `eas build` uses whoever is logged in, and any account that
  // isn't the projectId's owner fails with EAS_BUILD_PROJECT_ID_MISMATCH — which is what happened
  // on 8 Aug, and what `eas project:info` still reproduced on 20 Aug against the old id.
  owner: "imanaswer",
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
   * `backgroundColor` is the window behind the app — Android's `android:windowBackground`, iOS's
   * `RCTRootViewBackgroundColor` — seen during rotation, push transitions and behind a modal. A
   * build-time value cannot follow a runtime theme, and while this was the only thing setting it,
   * that surface was white under the dark palette: a white flash on every navigation.
   *
   * `ThemeProvider` now re-sets it from the active palette on every scheme change
   * (`SystemUI.setBackgroundColorAsync`), so this value only governs the window before JS runs —
   * which the native splash covers. It stays the light page so an OTA-less first frame is white,
   * not black, on the light theme. Do not "fix" the flash here; there is nothing static to fix.
   */
  userInterfaceStyle: "automatic",
  backgroundColor: "#FFFFFF",
  /**
   * EAS Update, pointed at THIS app's own project (`extra.eas.projectId` below).
   *
   * It was deliberately absent while this project had no EAS project of its own — inheriting the
   * ORIGINAL app's `updates.url` would have pushed that app's JS bundle onto this one. That hazard
   * ended on 7 Aug 2026 when this app got its own project, and leaving `updates` out after that
   * quietly cost the whole OTA lever: `expo-updates` shipped inside every binary but never checked
   * for anything, so every `eas update:*` command in RUNBOOK §3 — the documented way to roll back a
   * bad release in minutes — could not run, and M17's "runbook tested with one rehearsed OTA
   * rollback" exit criterion was unreachable.
   *
   * **Takes effect only in a NEW store build.** A binary compiled without this block has no update
   * URL baked into it and will never start checking; the first build carrying this is the earliest
   * one an OTA can ever reach.
   *
   * `fallbackToCacheTimeout: 0` = never block the splash on a network fetch. The update downloads
   * in the background and applies on the NEXT cold start, which is why RUNBOOK §3 says to budget
   * two app opens rather than one.
   */
  updates: {
    // Same id as `extra.eas.projectId` below — keep them in step. Verified 20 Aug 2026.
    url: "https://u.expo.dev/4cf1eebb-1290-452e-a748-697b64ca0d61",
    fallbackToCacheTimeout: 0,
  },
  /**
   * An OTA reaches only installs running the SAME `version` above. Bumping `version` orphans every
   * prior install from new updates — never bump it merely to ship an OTA fix.
   */
  runtimeVersion: { policy: "appVersion" },
  ios: {
    bundleIdentifier: variant.id,
    supportsTablet: false,
    // Uses only standard/exempt encryption (HTTPS) — skips the export-compliance prompt.
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
    // Universal Links (M13). Requires the matching apple-app-site-association on the web repo
    // (public/.well-known/, appID = TEAMID.net.gameground.redesigned — the bundle id THIS app
    // actually ships, which is `variant.id` above). Publishing the original app's
    // `net.gameground.app` there makes the association fail silently: no error anywhere, links
    // just keep opening the browser. See docs/DEEP_LINKS_WEB.md.
    associatedDomains: ["applinks:www.gameground.net", "applinks:gameground.net"],
  },
  android: {
    package: variant.id,
    adaptiveIcon: {
      backgroundColor: "#050505",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    // App Links (M13). autoVerify pairs with assetlinks.json (release SHA256) on the web repo,
    // served from every host in APP_LINK_DATA. See the note above that constant.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: APP_LINK_DATA,
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
    /**
     * Host UPI QR upload on the create-game screen. The plugin writes
     * `NSPhotoLibraryUsageDescription` into Info.plist; without it iOS terminates the app the
     * instant the picker is presented, rather than failing gracefully — so this is not optional
     * decoration, it is what keeps `pickImage` from crashing the app on iOS.
     *
     * Library only. Camera and microphone are deliberately not requested: a host's QR is a
     * screenshot or a saved image, never something photographed in the moment, and asking for
     * either would be requesting a capability this app never uses.
     *
     * **Both `false` values are load-bearing — omitting them does NOT mean "not requested".** This
     * plugin opts you IN by default: `withImagePicker` adds `android.permission.RECORD_AUDIO` and
     * an `NSMicrophoneUsageDescription` unless `microphonePermission` is explicitly `false`, and
     * the same for the camera. Passing only `photosPermission` therefore shipped a microphone
     * request — verified in the resolved config, which read
     * `android.permissions: ["android.permission.RECORD_AUDIO"]` — directly contradicting the
     * paragraph above it. Setting them to `false` also adds the permissions to
     * `blockedPermissions`, so a transitive dependency cannot re-add them behind our back.
     *
     * This is a store-review and privacy-label surface, not just tidiness: an unexplained mic
     * permission has to be declared in Play's Data Safety form and iOS's privacy nutrition labels
     * (M17), and one you cannot justify invites questions you have no answer to.
     */
    [
      "expo-image-picker",
      {
        photosPermission:
          "Game Ground needs access to your photos so you can attach your UPI QR code to a game you host.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    // Crash reporting — see `sentryPlugin` above. Empty unless SENTRY_DSN is set.
    ...sentryPlugin,
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
  extra: {
    appEnv: profile,
    sentryDsn,
    /**
     * THIS app's own EAS project — `@imanaswer/redesigned-gameground`, matching `owner` above.
     *
     * The id that used to be forbidden here was the ORIGINAL app's; inheriting it would have
     * pointed this project's builds and any future OTA channel at another app entirely. The value
     * below is this app's own.
     *
     * **Verified against the API on 20 Aug 2026, and that verification is the point.** Two earlier
     * ids failed here for two different reasons: `9a033e8c-…` resolved to no project at all, and
     * `e2ce390f-…` (`@sarangs1621/…`) resolved to a project this account cannot read —
     * `eas project:info` returned *Entity not authorized*, and a build would have died with
     * EAS_BUILD_PROJECT_ID_MISMATCH. A projectId is a value nothing in the repo can check for you:
     * `tsc`, `eslint`, `jest` and even `expo export` all pass with a wrong one, because it is never
     * dereferenced until `eas build` / `eas update` reaches the network. If you change it, run
     * `eas project:info`.
     *
     * **The Play upload keystore follows this project.** Whichever account owns it signs every
     * release of the listing, forever — which is why this is `imanaswer` and not the fork source.
     *
     * `EAS_PROJECT_ID` still wins when set, so a fork or a second environment can retarget builds
     * without editing this file. It must stay in step with `updates.url` above, which embeds the
     * same id — they are two copies of one fact.
     */
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "4cf1eebb-1290-452e-a748-697b64ca0d61" },
  },
};
