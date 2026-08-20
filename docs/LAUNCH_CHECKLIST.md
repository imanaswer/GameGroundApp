# Launch checklist — Game Ground Mobile

Written 7 Aug 2026, after the production-readiness audit (`docs/PRODUCTION_READINESS_AUDIT.md`).
Everything in **Part 1** is done and verified in this repo. Everything in **Part 2** needs an
account, a device or a person, and is the actual distance left to the store.

---

## Part 1 — closed in code

| # | Was | Now | Verified by |
|---|---|---|---|
| B5 | App requested `android.permission.RECORD_AUDIO` and an iOS microphone string it never uses | `cameraPermission: false` + `microphonePermission: false` on the `expo-image-picker` plugin; both also land in `blockedPermissions` | resolved config went from `permissions: ["android.permission.RECORD_AUDIO"]` → `permissions: null` |
| B3 | `scripts/release-check.sh` exited **1 on a clean tree** — its bare `KEY_SECRET` pattern matched the error text in `razorpay-errors.ts:34` | secret-name patterns now require an actual `NAME: "value"` binding; value-shaped patterns untouched | gate exits **0**; new `__tests__/release-check-pattern.test.ts` proves it still catches 5 planted secrets and stays silent on the real message |
| B2 | No `updates` block → `expo-updates` shipped but never checked; every `eas update:*` command in RUNBOOK §3 was dead | `updates.url` pointed at this app's real EAS project | resolved config carries `updates`, and the id was opened in a browser to confirm it resolves |
| B4 | RUNBOOK §0 listed the **original** app's project id, owner, slug and bundle id | corrected against `app.config.js`, plus scheme / update URL / version rows added | table now matches config field-for-field |
| B6 | **`app.config.js` carried a projectId that belonged to no project at all** — `9a033e8c-…` returned Page not found, and the account owned no project by that slug, despite a comment claiming it was created 7 Aug 2026 | real project created (`@sarangs1621/redesigned-gameground`) and its id written into `extra.eas.projectId` **and** `updates.url` | `expo.dev/projects/e2ce390f-…` resolves; both copies verified in the resolved config |
| B1 | Sentry entirely unconfigured — every build shipped with crash reporting off | project `gameground-mobile` created under org `gameground-oo`; `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` (plain) + `SENTRY_AUTH_TOKEN` (secret) set on `production` + `preview` | DSN checked against `DSN_SHAPE` before storing; all four listed in the EAS dashboard |
| B4b | `DEEP_LINKS_WEB.md` told the web team to publish `TEAMID.net.gameground.app` in AASA + assetlinks | corrected to `net.gameground.redesigned`, with the apex-host requirement spelled out | — |
| S1 | Every `ggredesign://` deep link resolved to null and routed **Home** — the resolver only knew `gameground://`, the original app's scheme | `segmentsOf` rewrites any non-http scheme by shape, not by name | 6 new test cases on the real scheme; dev-client and OAuth callback URLs asserted to stay unmappable |
| S2 | PostHog key absent from every build profile → analytics dead in production | key added to `preview` + `production` in `eas.json` (`development` left blank on purpose) | key now appears in both Hermes bundles |
| S3 | Android App Links declared only `www.gameground.net` while iOS declared the apex too | `APP_LINK_DATA` builds the host × path matrix; 12 entries across both hosts | resolved config: hosts `['gameground.net', 'www.gameground.net']` |
| S5 | Nothing recorded that `version` must be hand-bumped, so the kill switch could never tell two releases apart | RUNBOOK §0 now explains `appVersionSource: remote` governs build number / versionCode, **not** `version` | — |

**Gates after the changes:** `tsc` clean · `eslint` clean · **33 suites / 368 tests pass** (was 32/355) · production export of all three platforms succeeds · `release-check.sh` exits 0 · zero server secrets in the bundle (grepped for 7 literal values from `.env`).

### Two things to know about these fixes

- **The OTA and permission changes need a new native build.** `updates.url` and the Android manifest are compiled into the binary. Any build made before this commit is permanently unreachable by OTA and still carries `RECORD_AUDIO`.
- **`.env` could not be written from here** (the bridge blocks `.env` writes). The cleaned file is at `GameGroundApp/env-updated.txt` — rename it over `.env`. The old one had the entire web server's secrets in it.

---

## Part 2 — what is left

### 2.1 Blocking the store submission

- [x] ~~**Create the Sentry project and configure the DSN in EAS.**~~ **Done 7 Aug 2026.** Org `gameground-oo`, project `gameground-mobile`, four variables on `production` + `preview`. Note the org is in the **EU (`de`) region** — crash data is stored in Germany, which belongs in your privacy labels, and the region cannot be changed after org creation.
- [ ] **VERIFY THE PLAY CONSOLE TESTING GATE — this is now your longest-lead item.** Decided 8 Aug 2026: **Android-only launch; iOS is parked.** That removes Apple enrolment from the critical path and puts Google Play on it instead. Google requires **new personal developer accounts** to run a closed test with a minimum number of testers for a continuous period (it has been ~12 testers over 14 days) before they can apply for production access. **Organisation accounts are exempt.** I can't verify the current rule or your account type from here, and the policy has moved before — **open Play Console and check today**, because if it applies it adds two weeks *after* your app is otherwise ready, and it is invisible until you try to promote to production. If it applies, start the closed test the day you have a working build, and recruit testers in parallel with everything else.
- [ ] **Play Console account exists and is paid** (one-off registration fee). Confirm which type — personal or organisation — since that determines the gate above.
- [ ] **Create an EAS build — nothing else in this section can happen without one.** The project had never been built: the previous projectId pointed at nothing, the account shows *"Create your first build"*, and there are no Apple certs, push keys, App Store Connect keys, Apple Teams or Google service-account keys. This means M0's exit criterion was never met, and every device-dependent item below has been blocked on it all along.
- [ ] **Prove Sentry on a physical device, DSN set *and* unset.** The original crash was native; jest cannot see it. **The two build profiles give you both halves for free:** `development` carries no `SENTRY_DSN` (deliberately scoped to `production`+`preview`), so it *is* the DSN-unset case — cold-start it several times and watch for the launch crash that got Sentry stubbed originally. A `preview` build is the DSN-set case; confirm a real event lands in `gameground-mobile`.
- [ ] **Rotate the credentials that were sitting in `.env`.** Supabase DB password, Google client secret, Razorpay test secret, Resend key, Cloudinary secret, admin password. They lived in a mobile repo and were pasted into chat.
- [ ] **Razorpay device pass:** test-mode payment, Android UPI intent hop, then one live ₹1 and a refund, per platform. Phase-gate record.
- [ ] **Publish `assetlinks.json`** on both `www` and apex, using `net.gameground.redesigned` and the release SHA-256 from `eas credentials --platform android`. Verify with `adb shell pm get-app-links net.gameground.redesigned`. **AASA is parked with iOS** — it needs an Apple Team ID that won't exist until enrolment, and Android App Links do not depend on it.
- [ ] **Cut a build carrying these changes** and confirm on-device: no mic permission prompt, apex links open the app on Android, `eas update:list --branch production` responds.

**The first build must come from a terminal — the dashboard cannot do it.** Verified 7 Aug 2026:
"Build from GitHub" refuses with *"You don't have any build credentials stored in EAS for this app.
Without sufficient credentials, this build will fail,"* and the dashboard credentials wizard only
**uploads** a keystore you already have ("you'll need… Android upload keystore"). It will not
generate one. `eas build` in a terminal generates and stores the keystore automatically, and once
it exists every later build — including GitHub-triggered ones — works. So the CLI is a one-time
unlock, not an ongoing requirement.

**That keystore is the single most important secret in the project.** Every future Play release must
be signed with it; lose it and you cannot update the app under the same listing. Let EAS hold it
(`Generate new keystore`) rather than keeping it only on your laptop.

**Build sequencing decided 7 Aug 2026:** GitHub-triggered builds from `sarangs1621/gameground-mobile`, Android first (EAS generates the keystore; no Apple gate), `development` profile before `preview`. A GitHub build compiles whatever is on the remote — so the audit fixes must be **pushed** before the first build, or it will compile the old code: dead project id, no `updates` block, `RECORD_AUDIO` still requested, deep links still broken.

### 2.2 Web-repo work the app is waiting on

Neither web fix document requires a mobile change, so nothing here adds to the app's queue — but these stay broken until the server ships.

- [ ] `POST/DELETE /api/push/register`, `PATCH /api/push/prefs`, `DeviceToken` model, dispatcher. **All six M12 notification categories are undeliverable** until this exists, and there is no "notify affected users" lever in an incident.
- [ ] `GET /api/home` — Home is client-composed today, so the p95 < 300 ms single-request AC cannot be measured.
- [ ] Confirm push payloads emit URLs this app can resolve. Both `https://www.gameground.net/...` and `ggredesign://...` now work; `gameground://` reaches the original app, not this one.

### 2.3 Measurements and process (M15 → M17)

- [ ] Fill `docs/PERF.md` on the reference Android: cold start < 2.5 s, 60 fps scroll with no blank cells, download < 40 MB, airplane-mode tour.
- [ ] Maestro's 5 flows green on real hardware (they pass as selector contracts in CI today).
- [ ] Manual AC matrix on iPhone + 2 Androids including one low-end.
- [ ] S0–S1 security checklist item-by-item with evidence links.
- [ ] Rehearse the OTA rollback on `preview` and record the wall-clock time in RUNBOOK §8. That number is your real rollback SLA.
- [ ] Rehearse the kill switch on preview: set `MIN_MOBILE_VERSION` above the installed build, redeploy, confirm the wall, clear it.
- [ ] 15-person internal beta → fix cycle → ~50-user closed beta.
- [ ] Store assets, descriptions, **Play Data Safety form** — declare PostHog and Sentry accurately, and note the microphone permission is **gone** as of 7 Aug, so do not declare it. Reviewer demo account. Account deletion must be reachable in-app (Play requires it, not just Apple). **Sign in with Apple and iOS privacy nutrition labels are parked with iOS** — Guideline 4.8 is an Apple rule and does not apply to a Play-only release, though the code stays in and is Android-inert.
- [ ] Bump `version` in `app.config.js` before the release build.

---

## Release-day sequence

1. Bump `version` in `app.config.js`.
2. `npm run lint && npm run typecheck && npm test`
3. `APP_ENV=production EXPO_PUBLIC_RAZORPAY_KEY_ID=<live-key-id> bash scripts/release-check.sh` — must exit 0.
4. `eas env:list --environment production` — confirm `SENTRY_DSN` is there before you build.
5. `eas build --profile production --platform all`
6. `eas submit --profile production --platform all`
7. Play: staged 20 → 50 → 100 over ≥ 5 days, advancing only while crash-free ≥ 99.5%. iOS: phased release on.
8. Watch Sentry and PostHog. If something breaks, RUNBOOK §5 is the triage order — and check the web repo's deploys first, since the API is authoritative for prices, slots and eligibility.
