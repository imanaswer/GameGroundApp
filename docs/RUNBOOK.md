# Runbook — Game Ground Mobile

Operational procedures for a live app: how to stop a bad release, how to roll back, and what to
check first when something breaks in production. Required by M17; its exit criterion is a runbook
**tested with one rehearsed OTA rollback** — see [Rehearsal](#rehearsal-do-this-before-launch).

Verified against `eas-cli` 20.5.1. Commands that touch a store are UI-only where noted — Google and
Apple do not expose rollout control over the CLI.

---

## 0. Know these before you need them

> **Every value in this table is read straight off `app.config.js` / `eas.json`, and the project id
> was opened in a browser to confirm it resolves. It was wrong until 7 Aug 2026** — it carried the ORIGINAL app's project id, owner, slug and bundle id, which is the
> worst possible error in the one table you open mid-incident. If you change any of these, change
> them here in the same commit.

| Thing | Value |
|---|---|
| EAS project id | `e2ce390f-49f8-4665-89f5-180f9b240546` (`app.config.js` → `extra.eas.projectId`) |
| EAS owner / slug | `sarangs1621` / `redesigned-gameground` (`app.config.js` → `slug`) |
| Bundle id (prod) | `net.gameground.redesigned` (`.dev` / `.preview` suffixes on the other profiles) |
| App scheme | `ggredesign://` — **not** `gameground://`, which is the original app's |
| Update channels | `development`, `preview`, `production` (`eas.json`) |
| Update URL | `https://u.expo.dev/e2ce390f-49f8-4665-89f5-180f9b240546` (`app.config.js` → `updates`) |
| Runtime version policy | `appVersion` — an OTA can only reach builds of the **same** `version` |
| Marketing version | `1.0.0`, hardcoded in `app.config.js`. **Bump by hand every release** — see below |
| API | `https://www.gameground.net/api/*` (web repo `../GG(web)`) |
| Crash reporting | Sentry — **configured 7 Aug 2026**. Org `gameground-oo`, project `gameground-mobile`, EU (`de`) region. See §6 |
| Analytics | PostHog — key wired into the `preview` + `production` profiles in `eas.json` |

**The runtime-version rule matters.** `runtimeVersion: { policy: "appVersion" }` means an update
published while `version` is `1.0.1` reaches only installs running `1.0.1`. Bumping `version` in
`app.config.js` orphans every prior install from new OTAs. Never bump it to ship an OTA fix.

**The marketing version is not automatic.** `eas.json` sets `appVersionSource: "remote"` with
`autoIncrement: true`, and that governs the iOS **build number** and the Android **versionCode** —
not `version`. `version` is the literal `"1.0.0"` in `app.config.js`, it is what every request sends
as `X-App-Version` (`src/api/client.ts`), and it is what the §2 kill switch compares against. If you
ship 1.0.1 without editing that literal, `MIN_MOBILE_VERSION` cannot tell the two releases apart and
your only options are "gate nobody" or "gate everyone". **Bump `version` in `app.config.js` as the
first step of every store release**, and remember it starts a fresh OTA runtime (see above).

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

**Client side is already wired:** `src/api/client.ts` turns any HTTP 426 into a route to
`app/upgrade-required.tsx`, a no-dismiss, no-back wall (`rawRequest`, the `res.status === 426`
branch). Every request sends `X-App-Version` from `Constants.expoConfig.version` (the headers block
of the same function). Line numbers are deliberately not cited — they were wrong within a month.

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

> **Prerequisite, and it has a hard cutoff.** This whole section needs `updates.url` in
> `app.config.js`. It was absent until 7 Aug 2026 — `expo-updates` shipped inside every binary but
> had no URL to check, so none of the commands below could do anything. **Any build produced before
> that config landed is permanently unreachable by OTA**: the URL is compiled into the binary, so an
> already-installed app cannot be taught to start checking. For those installs your only levers are
> §2 (kill switch) and §4 (store rollback). Confirm with `eas update:list --branch production` —
> if the branch has no updates and the installed build predates the config, do not wait on an OTA.

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

**Configured 7 Aug 2026.** The Sentry project exists and the variables are set on EAS, so §5 step 1
and the Play promotion gate finally have a data source — *once a build carrying them is installed*.
Nothing retroactively instruments a binary built before this.

| | |
|---|---|
| Org | `gameground-oo` (EU / `de` region — crash data is stored in Germany; declare it in your privacy labels) |
| Project | `gameground-mobile` |
| EAS vars | `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` (plain text) + `SENTRY_AUTH_TOKEN` (secret), all on `production` + `preview` |
| Not on `development` | deliberate — local runs should not send crashes or burn quota |

The DSN was checked against `DSN_SHAPE` before being stored. Do that for any replacement: a DSN that
fails the regex is treated as *unset* by both `app.config.js` and `src/lib/sentry.ts`, so a typo
presents as "Sentry is silently off", never as an error.

### Turning it on

`.env` is gitignored, so it never reaches an EAS build — a DSN that exists only there configures
nothing. The values have to live in EAS. Create the Sentry project first, then:

```bash
# Non-secret, but environment-scoped. EAS injects these into the build automatically;
# they do NOT need to be listed in eas.json.
eas env:create --name SENTRY_DSN     --value "https://<key>@<host>/<numeric-project-id>" \
  --environment production --environment preview --visibility plaintext
eas env:create --name SENTRY_ORG     --value "<org-slug>"     --environment production --environment preview --visibility plaintext
eas env:create --name SENTRY_PROJECT --value "<project-slug>" --environment production --environment preview --visibility plaintext

# Secret — source-map upload only. Without it the plugin warns and skips the upload
# rather than failing the build, so a missing token degrades, it does not block.
eas env:create --name SENTRY_AUTH_TOKEN --value "<token>" \
  --environment production --environment preview --visibility secret

eas env:list --environment production   # verify before building
```

The DSN must match `https://<key>@<host>/<numeric project id>`. A placeholder like
`https://...@sentry.io/...` is treated as unset by both `app.config.js` and `src/lib/sentry.ts` —
deliberately, see above — so a typo shows up as "Sentry silently off", not as an error. Check
`eas env:list` rather than assuming.

Then **prove launch on a physical dev client with the DSN both set and unset**. That step is not
optional: the original fault was native and cannot appear in jest.

---

## 7. Known gaps in this runbook

Written honestly so nobody discovers these mid-incident:

- **Kill switch is implemented but never fired in anger.** Unit-tested and exercised against a dev
  server (§2); never rehearsed on a deployed environment against a real build. Do that on preview.
- **Sentry is configured but has never received an event.** The project, DSN and EAS variables all
  exist (§6), and the DSN validates. What has *not* happened is the physical-device proof the
  original native crash demands — build with the DSN set AND unset, confirm no launch crash either
  way, confirm an event actually lands in the project. Until then "crash reporting works" is an
  inference, not an observation.
- **OTA is configured but never rehearsed, and cannot reach old builds.** `updates.url` landed
  7 Aug 2026; no update has been published or rolled back on this project, and every binary built
  before that date is unreachable by OTA forever (§3). Treat §3 as untested until the rehearsal
  below is done on a build that carries the config.
- **Push notifications are dead.** `/api/push/register` and `/api/push/prefs` do not exist in the
  web repo, so there is no "notify affected users" option in an incident.
- **Analytics only just wired.** The PostHog key reaches `preview` and `production` builds via
  `eas.json`; `development` is deliberately left without one so local runs do not pollute the
  dataset (`src/lib/analytics.ts` no-ops without a key). Nothing has been verified against a live
  project yet, so §5 step 1's "PostHog active users" is unproven.

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
