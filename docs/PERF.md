# Performance & Offline — M15

Budgets are pass/fail (Developer PRD §13 / product §8.2). Cold-start and scroll FPS are measured
on the **reference mid-range Android** (Redmi Note class) — they cannot be produced in a headless
build, so those rows are marked *pending device* with the exact method to run.

## Budgets

| Budget | Target | Status |
|---|---|---|
| Cold start → interactive (reference Android) | < 2.5s | ⏳ pending device — measure per method below |
| List scroll | 60fps, no blank cells | ⏳ pending device (FlashList v2 auto-sizes; recyclingKey set) |
| Android download size | < 40 MB | ⏳ pending EAS build page (JS bundle ≈ 7 MB Hermes; native libs dominate the rest) |
| Blurhash/placeholder paint | < 100ms | ⏳ pending device (expo-image placeholder + fade wired) |
| Bundle secret-grep | zero hits | ✅ `scripts/release-check.sh` passes on a production export; fails on a planted secret |

## What M15 changed (headless-verifiable)

- **Disk persistence**: `PersistQueryClientProvider` + AsyncStorage persister, `maxAge` 24h,
  buster = app version (`src/lib/query-persist.ts`). `gcTime` raised to 24h so persisted entries
  survive to restore. Cached lists/details now render instantly on next launch and offline.
- **Offline everywhere**: `useIsOnline` (NetInfo → onlineManager) drives the offline banner on
  every tab and disables every mutating CTA (join / register / book) with a hint — writes fail
  loudly, never silently queue (§8.3, a v1 non-goal).
- **List perf**: leaf cards (`GameCard`, `CoachCard`, `RegistrationCard`) are `memo`-wrapped;
  FlashList v2 auto-measures item size (no `estimatedItemSize` needed); images already carry
  `recyclingKey` + `contentFit` + fade.
- **Lazy modules**: the pinch-zoom lightbox is `React.lazy` + `Suspense`, loaded only on first
  photo tap. Routes are already code-split by Expo Router.
- **Deferred init** (confirmed from M4): Sentry + PostHog init runs post-first-frame via
  `InteractionManager`, off the cold-start path.
- **Release gate**: `scripts/release-check.sh` — export → grep for `rzp_live`/`sk_live`/
  `AUTH_SECRET`/`key_secret`/JWT-shaped tokens across the bundle (incl. Hermes string table),
  nonzero exit on hit. Wire into CI on release branches.

## How to measure the device-gated rows

1. **Cold start**: release build on the reference Android. `adb shell am start -W -n
   net.gameground.app/.MainActivity` five times from a cold kill; record `TotalTime`; take the
   median. Target < 2500ms.
2. **Scroll FPS**: Perf Monitor (or `adb shell dumpsys gfxinfo`) while flinging the Games list
   with 50+ items; no frame > 32ms, no blank cells.
3. **Download size**: EAS build page → Android app size, or `bundletool get-size total` on the
   `.aab`. Target < 40 MB.
4. **Offline tour**: airplane mode, walk every tab — cached content + banner, zero crashes;
   every mutating control disabled.

Record the numbers in this table when the reference device run happens (before M16).
