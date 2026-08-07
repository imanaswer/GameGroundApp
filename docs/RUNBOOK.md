# Runbook — Game Ground Mobile

Operational procedures for a live app: how to stop a bad release, how to roll back, and what to
check first when something breaks in production. Required by M17; its exit criterion is a runbook
**tested with one rehearsed OTA rollback** — see [Rehearsal](#rehearsal-do-this-before-launch).

Verified against `eas-cli` 20.5.1. Commands that touch a store are UI-only where noted — Google and
Apple do not expose rollout control over the CLI.

---

## 0. Know these before you need them

| Thing | Value |
|---|---|
| EAS project id | `c51e7b53-2f3f-4556-b1c7-4e539836f90a` (`app.config.js` → `extra.eas`) |
| EAS owner / slug | `imanaswer` / `gameground-mobile` |
| Bundle id (prod) | `net.gameground.app` (`.dev` and `.preview` for the other profiles) |
| Update channels | `development`, `preview`, `production` (`eas.json`) |
| Runtime version policy | `appVersion` — an OTA can only reach builds of the **same** `version` |
| API | `https://www.gameground.net/api/*` (web repo `../GG`) |
| Crash reporting | Sentry — **currently disabled**, see §6 |

**The runtime-version rule matters.** `runtimeVersion: { policy: "appVersion" }` means an update
published while `version` is `1.0.1` reaches only installs running `1.0.1`. Bumping `version` in
`app.config.js` orphans every prior install from new OTAs. Never bump it to ship an OTA fix.

---

## 1. Decide: OTA or store build?

| Change | Ship as |
|---|---|
| JS-only: copy, layout, non-native bug fix | **OTA** |
| Anything touching payments or auth | **Store build** (policy, §15 — not a technical limit) |
| Any native module added/removed/upgraded | **Store build** (a runtime mismatch cannot be OTA'd) |
| `app.config.js` plugins, permissions, entitlements | **Store build** |

When unsure, ship a store build. A wrong OTA is harder to reason about than a slow fix.

---

## 2. Kill switch — force everyone onto a new version

The hard stop. Blocks the app at the API layer regardless of what JS is on the device, so it works
even when the bug is in the shipped bundle.

**Client side is already wired:** `src/api/client.ts:92` turns any HTTP 426 into a route to
`app/upgrade-required.tsx`, a no-dismiss, no-back wall. Every request sends `X-App-Version`
(`src/api/client.ts:73`).

**Server side shipped 2026-08-02** — `../GG/src/lib/mobileVersion.ts`, wired into `src/proxy.ts`
ahead of rate limiting. Gate is off while `MIN_MOBILE_VERSION` is unset.

```bash
# In the web repo's host (Vercel): set the minimum acceptable app version…
MIN_MOBILE_VERSION=1.0.2
# …then REDEPLOY. Vercel only hands new env values to new deployments — setting the variable
# alone changes nothing on the running one.
```

Effect: every install below `1.0.2` gets `426` on its next API call and hits the upgrade wall.
Irreversible for users until they update from the store — use it for data-corruption or money
bugs, not cosmetics. To lift it, clear the variable and redeploy.

Behaviour, verified against a running server on 2026-08-02:

| Request | Result |
|---|---|
| `X-Client: mobile`, version below the floor | `426` + `{"ok":false,"error":"Please update Game Ground to continue."}` |
| version equal to or above the floor | passes through |
| `X-Client: mobile`, no `X-App-Version` | `426` (fails closed) |
| no `X-Client` header (browser) | passes through — the web app is never gated |
| `MIN_MOBILE_VERSION` unset or unparseable | everything passes — a typo cannot lock users out |

The 426 carries `Cache-Control: no-store` so a CDN can never replay it to a client that has since
updated, and echoes `x-request-id` for support.

**Rehearse it on preview before you ever need it in production:** set the variable in the preview
environment above the installed build's version, redeploy, confirm the wall appears, then clear it.

---

## 3. OTA rollback

Fastest lever: minutes, no store review. Only reaches installs on the same runtime version.

```bash
# 1. See what is live and pick the last-good update group.
eas update:list --branch production

# 2. Republish that group to the front of the branch. This is the rollback.
eas update:republish --group <GROUP_ID> -m "rollback: <what broke>"

# 3. Confirm it is now the newest on the branch.
eas update:list --branch production --limit 3
```

To roll all the way back to the bundle that shipped inside the store build (i.e. undo *every* OTA):

```bash
eas update:rollback   # interactive; select the embedded update
```

Users pick the change up on next cold start — expo-updates fetches on launch, applies on the
following launch. **Budget two app opens, not one.** There is no way to force it sooner.

Staged OTA, when you want to de-risk the fix itself:

```bash
eas update --branch production --rollout-percentage 10 -m "fix: <x>"
# watch crash-free, then raise
eas update --branch production --rollout-percentage 100 -m "fix: <x> — full"
```

---

## 4. Store rollback

### Google Play — halt a staged rollout

Play Console → **Release ▸ Production ▸ Releases** → active release → **Halt rollout**.

Halting stops *new* users receiving it. Users who already updated **stay on the bad version** —
Play has no downgrade. Recovery is always forward: halt, then ship a fixed build as a new release,
or use §2/§3 to neutralise the bad one.

Promotion gate (§15): 20% → 50% → 100% over ≥ 5 days, advancing only while crash-free ≥ 99.5%.

### Apple App Store — pause a phased release

App Store Connect → your app → **App Store ▸ [version] ▸ Phased Release for Automatic Updates** →
**Pause**. Same asymmetry: already-updated users stay put. "Remove from sale" pulls the listing
entirely — a last resort, and it does not touch installed apps.

An expedited review request is the fast path for a genuine emergency; use it sparingly, Apple
tracks how often you ask.

---

## 5. Triage order when production breaks

1. **How wide?** Sentry crash-free rate (§6) and PostHog active users. A crash on one device model
   is not a rollback.
2. **Which surface?** If money or auth — go straight to §2, do not wait for a fix. If cosmetic or a
   single screen — §3.
3. **Is it JS?** If yes, an OTA fixes it in minutes. If native, you are on store timelines and §2 is
   your only fast lever.
4. **Is it actually the server?** The API is authoritative for prices, slots, eligibility and
   reputation. A mobile-looking bug is often a web-repo deploy. Check `../GG` deploys first —
   rolling back a Vercel deploy is faster than anything in this document.
5. **Record it.** Append to §8 below.

---

## 6. Sentry — restored, but inert until a DSN is set

Decisions 28 and 30. `src/lib/sentry.ts` is a real implementation again: `initSentry` validates the
DSN, `require`s `@sentry/react-native` **lazily and only after** that check, and runs errors-only
(`tracesSampleRate: 0` — tracing and session replay are exactly where the launch-time native
surprises live). `scrubEvent` is wired into both `beforeSend` and `beforeBreadcrumb`. A failed
`init` is swallowed: crash reporting must never be the thing that crashes the app.

**Pinned to `~7.2.0`, which is what `expo/bundledNativeModules.json` pins for SDK 54.** The crash
that got it removed was on **7.11** — nine minors ahead of anything Expo tests against this runtime,
and a version `npx expo install` would never have chosen. **8.x is not the safer answer** despite
being current: it is further from what SDK 54 ships and Sentry issue #5679 reports the same failure
class there. Do not bump this without reading Decision 28.

**The gate is the DSN's shape, not its presence.** `.env` ships a placeholder for every unconfigured
secret, and a placeholder is a truthy string — so the old `if (!sentryDsn)` armed both the SDK and
the native config plugin on every machine that had never configured Sentry, which is precisely the
configuration 7.11 crashed on. `app.config.js` and `src/lib/sentry.ts` now both test
`https://<key>@<host>/<numeric project id>`, and `__tests__/sentry-init.test.ts` asserts the two
regex literals stay character-identical, because two copies of a rule drift.

**Still true for this runbook: with no real DSN configured, §5 step 1 has no data source and the
Play promotion gate (crash-free ≥ 99.5%) has nothing to measure.** The code is ready; the Sentry
project is the missing half.

To turn it on: create the Sentry project, set `SENTRY_DSN` in the EAS production profile (plus
`SENTRY_ORG` / `SENTRY_PROJECT` for source-map upload and `SENTRY_AUTH_TOKEN` at build time — without
the token the plugin warns and skips the upload rather than failing the build), then **prove launch
on a physical dev client with the DSN both set and unset**. That last step is not optional: the
original fault was native and cannot appear in jest.

---

## 7. Known gaps in this runbook

Written honestly so nobody discovers these mid-incident:

- **Kill switch is implemented but never fired in anger.** Unit-tested and exercised against a dev
  server (§2); never rehearsed on a deployed environment against a real build. Do that on preview.
- **No crash telemetry yet.** Sentry is restored in code but inert until a real `SENTRY_DSN` is
  configured, and the restored path has not been proven on a physical device (§6).
- **Never rehearsed.** No OTA rollback has been performed on this project. Until the rehearsal
  below is done, treat §3 as untested.
- **Push notifications are dead.** `/api/push/register` and `/api/push/prefs` do not exist in the
  web repo, so there is no "notify affected users" option in an incident.

---

## Rehearsal (do this before launch)

M17 requires a *tested* runbook. On the `preview` channel, not production:

1. `eas update --branch preview -m "rehearsal: deliberate visible change"` — ship an obvious
   cosmetic change (e.g. a changed home greeting).
2. Cold-start the preview build twice; confirm the change appears.
3. `eas update:list --branch preview` — note the previous group id.
4. `eas update:republish --group <PREVIOUS_ID> -m "rehearsal: rollback"`.
5. Cold-start twice; confirm the change is gone.
6. Record the wall-clock time from step 4 to step 5 in §8. That number is your real rollback SLA —
   quote it, not an estimate.

---

## 8. Incident log

| Date | What broke | Detected by | Lever used | Time to mitigate |
|---|---|---|---|---|
| _(rehearsal goes here first)_ | | | | |
