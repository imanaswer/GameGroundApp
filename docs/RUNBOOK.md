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

**Server side is NOT implemented.** As of 2026-08-02 there is no `MIN_MOBILE_VERSION` check in
`../GG`. **Until that ships, you have no kill switch.** See §7.

Once implemented:

```bash
# In the web repo's host (Vercel): set the minimum acceptable app version, then redeploy.
MIN_MOBILE_VERSION=1.0.2
```

Effect: every install below `1.0.2` hits the upgrade wall on its next request. Irreversible for
users until they update from the store — use it for data-corruption or money bugs, not cosmetics.

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

## 6. Sentry — currently disabled

`src/lib/sentry.ts` is a no-op shim and the config plugin is commented out of `app.config.js`.
Commit `4e8c579` removed `@sentry/react-native` 7.11 after its native Expo AppDelegate auto-init
threw `NSInvalidArgumentException` at launch — **with no DSN set**, which is the likely trigger.

**Consequence for this runbook: §5 step 1 has no data source, and the Play promotion gate
(crash-free ≥ 99.5%) has nothing to measure.** Until Sentry is restored, production crashes are
invisible and staged rollout is advancing on faith.

Restoring it (see `.scratch/PATH-TO-PRODUCTION.md` A3): create a Sentry project, put a real
`SENTRY_DSN` in the EAS production profile, install the package, restore the plugin entry, wire the
already-tested `scrubEvent` into `beforeSend`, then prove launch on a dev client. Note that
`npx expo install` resolves `~7.11.0` for SDK 57 — reaching 8.x means pinning it explicitly.

---

## 7. Known gaps in this runbook

Written honestly so nobody discovers these mid-incident:

- **No kill switch.** `MIN_MOBILE_VERSION` is unimplemented server-side (§2).
- **No crash telemetry.** Sentry disabled (§6).
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
