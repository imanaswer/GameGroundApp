# GameGround Mobile — production readiness audit

**Date:** 7 Aug 2026 · **Commit state:** working tree as staged from `GameGroundApp`
**Method:** full `npm ci` + `tsc` + `eslint` + `jest` + production `expo export` for all three platforms, run in a clean Linux container; then hand review of auth, payments, API client, deep links, release config, and the project's own docs.

---

## Verdict

**Not yet.** The *code* is in good shape — every automated gate is green, and a production bundle export proves no secret reaches the app. What is missing is the **operational half of a launch**: there is no crash telemetry in any build you can ship, no working rollback lever, a release gate that fails on a clean tree, and a runbook whose identifiers are all wrong. Those are the things you need on the day something breaks, and none of them work today.

Five blockers below are fixable in well under a day. Two are one-line changes.

---

## What passed

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean, 0 errors |
| `eslint .` | clean, 0 errors, 0 warnings |
| `jest` | **32 suites, 355 tests, all pass** |
| `expo export --platform all` (APP_ENV=production) | succeeds — iOS 8.01 MB hbc, Android 8.01 MB hbc, web 4.65 MB, 4.2 MB assets |
| Secret leakage | **zero** — grepped the exported bundle for 11 literal values from `.env` (DB password, Google secret, Razorpay secret, Resend key, Cloudinary secret, admin password, Supabase project ref, PostHog key, OAuth client id): **0 hits each** |

The architectural invariants hold under inspection: no money is computed client-side (`api/payments.ts` sends no amount; `create-order` derives paise server-side), `src/api/client.ts` is the only fetch site, `src/lib/storage.ts` is the only `expo-secure-store` site, and the 401→single-flight-refresh→replay logic is correct including the subtle mutation case. The defensive narrowing in `src/lib/env.ts` (`extraString`) is doing real work — the resolved config shows `extra.sentryDsn` arriving as `{}` rather than a string, which the old `as string | null` cast would have crashed on.

`expo-doctor` reported 16/18, and both failures were my container's network reach (the Expo schema endpoint and the RN Directory API), not your project. Re-run it locally.

---

## Blockers

### B1 · No crash reporting in any shippable build

`SENTRY_DSN` appears in **none** of the three `eas.json` profiles, and `.env` is gitignored so it never reaches an EAS build. `src/lib/sentry.ts:104` gates on `usableDsn(env.sentryDsn)` and returns early, so `initSentry` is a no-op in every build EAS produces.

Consequences, both already written down in your own docs: M16's exit criterion is *crash-free ≥ 99.5% across beta*, and RUNBOOK §4 gates the Play rollout 20→50→100 on the same number. **Neither has a data source.** RUNBOOK §7 admits this ("No crash telemetry yet"); it is still true.

**Fix:** create the Sentry project, then add `SENTRY_DSN` to the `production` (and `preview`) profile `env` blocks, plus `SENTRY_ORG` / `SENTRY_PROJECT` and a `SENTRY_AUTH_TOKEN` EAS secret for source-map upload. Then do the physical-device pass BACKLOG demands — DSN set *and* unset — because the original 7.11 fault was native and jest cannot see it.

> **Caveat I could not resolve from the repo:** if you have already set these as EAS environment variables in the dashboard rather than in `eas.json`, this blocker is void. Confirm with `eas env:list --environment production`.

### B2 · The OTA rollback lever does not exist

`app.config.js` has no `updates` block — deliberately, per its own comment at line 116. I confirmed against the resolved config: `updates = null`.

RUNBOOK §3 is three pages of `eas update:list` / `eas update:republish` / `eas update:rollback`, and §5 step 3 says "an OTA fixes it in minutes." **None of those commands can work.** `expo-updates ~29.0.19` ships inside the binary but never checks for anything. M17's exit criterion — *"runbook tested with one rehearsed OTA rollback"* — is unachievable as written.

**Fix, pick one:**
- Run `eas init`, add an `updates` block pointing at this project's own id (`9a033e8c-…`), and rehearse the rollback on `preview` as RUNBOOK describes; **or**
- Accept no-OTA for v1 and rewrite RUNBOOK §3 + §5 to say so plainly. Your only levers then are the §2 kill switch and a store release — which is survivable, but you must know it *before* an incident, not during one.

The deliberate-omission reasoning in `app.config.js` (don't inherit the original app's channel) was correct at the time; it is now stale, because this app owns its own EAS project as of 7 Aug 2026.

### B3 · The release gate fails on a clean tree

```
$ APP_ENV=production SKIP_EXPORT=1 bash scripts/release-check.sh dist
✖ Potential secret(s) found in the bundle:
dist/_expo/static/js/web/entry-cc96e5c0…js:KEY_SECRET
Release blocked.
exit code = 1
```

There is no secret. The pattern `KEY_SECRET` (line 46 of the script) matches the **error-message string** in `src/lib/razorpay-errors.ts:34`:

> `"Payments aren't configured on the server yet — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."`

It survives into the web bundle (0 occurrences in the iOS/Android Hermes bytecode; 1 in web). Since the script exports `--platform all`, every production cut fails.

The script's own header warns against exactly this: *"a bare `rzp_live_` grep would fail every production cut and train people to bypass the gate."* The same trap closed on a different pattern.

**Fix:** either scan only `ios/` and `android/` (the bundles that actually ship to a device), or exclude the known literal — e.g. filter hits matching `RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET`. A gate that is always red is worse than no gate.

### B4 · Every identifier in RUNBOOK §0 is wrong

That table is what you open at 2am. All three rows disagree with `app.config.js`:

| RUNBOOK §0 says | Actually |
|---|---|
| EAS project id `c51e7b53-2f3f-4556-b1c7-4e539836f90a` | `9a033e8c-b3e7-4c09-95d9-a0306947e718` |
| owner / slug `imanaswer` / `gameground-mobile` | slug `redesigned-gameground` (owner unset in config; comment says `@sarangs1621`) |
| prod bundle id `net.gameground.app` | `net.gameground.redesigned` |

The stale bundle id has a second victim: `app.config.js:126` tells the web repo to publish an `apple-app-site-association` with `appID = TEAMID.net.gameground.app`. Publish that and **Universal Links will silently never verify**, because the installed app is `net.gameground.redesigned`. Check `docs/DEEP_LINKS_WEB.md` for the same value before the web team ships it.

Minor drift in the same document: §2 cites `src/api/client.ts:92` for the 426 route (actually line 134) and `:73` for `X-App-Version` (actually line 110).

### B5 · The app requests microphone permission it never uses

Resolved production config: `android.permissions = ['android.permission.RECORD_AUDIO']`.

Source: `expo-image-picker`'s config plugin adds `RECORD_AUDIO` unless you pass `microphonePermission: false`. `app.config.js:202-208` passes only `photosPermission`. iOS gets a default `NSMicrophoneUsageDescription` ("Allow GameGround to access your microphone") the same way.

This directly contradicts the block comment sitting above it — *"The camera permission is deliberately not requested… asking for the camera would be requesting a capability this app never uses."* The intent was right; the microphone slipped through. It also means your Play **Data Safety** form and iOS **privacy nutrition labels** (M17) must either declare microphone access or be wrong, and an unexplained mic permission is a real review-and-trust cost.

**Fix — one line:**

```js
["expo-image-picker", {
  photosPermission: "Game Ground needs access to your photos so you can attach your UPI QR code to a game you host.",
  cameraPermission: false,
  microphonePermission: false,
}],
```

---

## Should fix before launch

### S1 · Every custom-scheme deep link routes to Home

`src/lib/deeplinks.ts:41` normalises only `gameground://`. That is the **original** app's scheme — this app deliberately registers `ggredesign` (`app.config.js:95`) precisely so the two don't collide. So the one custom scheme the resolver handles is one the app can never receive, and the one it does receive is unhandled.

Verified parse behaviour:

| Input | `pathname` | `resolveDeepLink` |
|---|---|---|
| `ggredesign://game/abc123` | `/abc123` | **null → Home** |
| `ggredesign://leaderboard` | `""` | **null → Home** |
| `https://www.gameground.net/games/abc123` | `/games/abc123` | `/game/abc123` ✅ |

`__tests__/deeplinks.test.ts` asserts only against `gameground://`, so the suite stays green over the defect.

Universal links (https) are unaffected, and `share.ts` correctly emits https only — so this is **latent today**. It goes live the moment push ships, because notification payloads carry `data.url` (`notifications.ts:199`) straight into `route()`. If the server ever emits the custom scheme, taps silently land on Home.

**Fix:** normalise the app's actual scheme (read it from config rather than hardcoding), and add `ggredesign://` cases to the test.

### S2 · Analytics will be dead in production

`EXPO_PUBLIC_POSTHOG_KEY` is absent from all three `eas.json` profiles and blank in `.env`. `analytics.ts:14` returns early without a key, so `capture`/`identify` are no-ops. RUNBOOK §5 step 1 names "PostHog active users" as a triage input, and M17's launch dashboard (installs, D1, payment success) depends on it. Same fix shape as B1 — put the key in the profile `env` blocks. (It's publishable; it belongs in `eas.json`, not a secret.)

### S3 · Android App Links miss the apex domain

iOS declares both: `associatedDomains: ["applinks:www.gameground.net", "applinks:gameground.net"]`. Android's `intentFilters` declare only `www.gameground.net`. A link to `https://gameground.net/games/x` opens the browser on Android and the app on iOS. Add apex `data` entries (or a second filter block).

### S4 · Dev and preview builds point at the production API

All three profiles set `EXPO_PUBLIC_API_URL=https://www.gameground.net`. Every QA tap during the M16 beta writes to live data — including the payment paths. The PRD's "there is no new backend" makes this partly unavoidable, but at minimum the **live ₹1 payment test** and the 50-person closed beta should run with eyes open about which database they're mutating.

### S5 · `X-App-Version` is pinned to `1.0.0` forever

`app.config.js:88` hardcodes `version: "1.0.0"`, and `X-App-Version` reads it (`client.ts:110`). `eas.json`'s `appVersionSource: "remote"` + `autoIncrement: true` manage `buildNumber`/`versionCode` — not the marketing `version`. So the kill switch (`MIN_MOBILE_VERSION`, RUNBOOK §2) can only ever be set to `1.0.0` or lock out every install including the newest. Bumping `version` by hand on every release is a required step; add it to the release checklist.

---

## Already known and documented — still open

These are in your own `BACKLOG.md` / `SYSTEM_LOGIC_AUDIT.md §6`, listed so the picture is complete. Both web-fix documents state **"No mobile app change is required"**, so the work you just finished on the web side adds nothing to the app's queue.

- **Push has no server half** — `/api/push/register`, `/api/push/prefs`, `DeviceToken`, dispatcher. All six M12 categories undeliverable; the client degrades silently and retries.
- **AASA / assetlinks.json not served** from `gameground.net` — needs the Apple Team ID and the release SHA-256 (`eas credentials`). Check the bundle id per B4 first.
- **`GET /api/home` missing** — Home is client-composed; the p95 < 300 ms single-request AC can't be measured.
- **Device passes owed:** Sentry launch with DSN set *and* unset; Razorpay test payment + Android UPI intent + one live ₹1 + refund; the M15 perf table in `docs/PERF.md` (cold start < 2.5 s, 60 fps scroll, Android download < 40 MB, airplane-mode tour); Maestro's 5 flows on real hardware.
- **M16/M17 process:** manual AC matrix on 3 devices, S0–S1 security checklist with evidence, 15-person internal then ~50-person closed beta, store assets, privacy labels, reviewer account, rollback rehearsal.

---

## What I could not check

- **EAS dashboard state** — environment variables, secrets, credentials, and whether an EAS project/channel already exists. B1 and S2 both hinge on this; `eas env:list` settles them in seconds.
- **Anything device-only** — the native Sentry launch path, the Razorpay WebView, UPI intent handoff, perf numbers, real deep-link verification. The report cannot substitute for the physical-device passes your own docs require.
- **The web repo** — I audited only `GameGroundApp`. Claims about server behaviour here are quoted from your audit docs, not re-verified.
- `expo-doctor`'s config-schema and RN-Directory checks (network-blocked in my container).

---

## Suggested order

1. B5 and B3 — one-line each, do them now.
2. B4 — correct RUNBOOK §0 and check `DEEP_LINKS_WEB.md`'s bundle id before the web team publishes AASA.
3. B1 + S2 — Sentry project and PostHog key into `eas.json`, then the device pass. Nothing downstream can be measured until this lands.
4. B2 — decide OTA or no-OTA, and make the runbook honest either way.
5. S1, S3, S5 — small code/config fixes with tests.
6. Then the beta, and only then submission.
