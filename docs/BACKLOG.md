# BACKLOG — Game Ground Mobile

Items live here until a written decision moves them into a milestone (see docs/DECISIONS.md). Nothing on this list enters a branch without that.

## Backend dependencies surfaced by M12 (client push) — web repo work

The client-side push infra is complete and degrades gracefully, but end-to-end delivery needs the web-repo server half (dev PRD §10.1), none of which exists yet:
- `POST /api/push/register` (upsert DeviceToken, refresh lastSeenAt) · `DELETE /api/push/register` · `PATCH /api/push/prefs`.
- `DeviceToken` Prisma model + `src/lib/push.ts` dispatcher; call sites: reminders cron, waitlist promotion, event announcement, payment webhook, tier change, game cancel.
- An EAS project id / credentials so `getExpoPushTokenAsync` yields a real token (dev/simulator returns none — the client no-ops gracefully until then).
Until these land, registration/prefs calls fail silently (logged to Sentry), the app never crashes, and it retries on each app open.

## M9A Home — client-half shipped; server-half + hero flourish remain

The launch-tab ship-blocker (Home was an M9A placeholder) is **resolved**: `app/(tabs)/home.tsx`
now renders a real client-composed feed (greeting, Up-Next feature, Starting-soon list, coaches
rail, "set your sports" setup card, full loading/empty/offline states) from the live `/games` +
`/coaches` endpoints via `useHome`. No fabricated backend. Remaining (web-repo / polish):
- **`GET /api/home`** server-half (authed, per-user sections, p95 < 300ms). When it ships, swap
  the body of `src/hooks/queries/home.ts` to the single request — consumers are unchanged.
- Full **UpNextHeroCard** + live **ticker** flourish (DS §6 / Design-Excellence-v3) — a delight
  pass on top of the working screen, not a blocker.

## M15 perf — device-gated measurements (see docs/PERF.md)

Code changes are complete (persistence, offline gating, memoization, lazy lightbox, release-check.sh — all bundle-verified). The pass/fail *measurements* need the reference Android: cold-start < 2.5s, 60fps scroll / no blank cells, Android download < 40 MB, and the airplane-mode tour. Method for each is in `docs/PERF.md`; fill the table before M16.

## M14 delight — rows needing on-device iteration (not shipped headlessly)

Delivered as reusable, bundle-verified primitives: CountUp (§8), Confetti (§5), tier-up
takeover (§5, fires once), extended payment-success confetti (§5), centralized haptics, and a
verified reduced-motion path. The following MOTION.md rows are deliberately **not** shipped
blind because they either fight the platform or misfire without a device to tune against — do
them in an on-device pass:
- **Shared-element card→detail** (`sharedTransitionTag`) — Reanimated shared transitions are
  fragile; needs device tuning per Games/Coaches/Discover.
- **List-entrance stagger** — FlashList recycles cells, so per-item `entering` re-fires on
  scroll (MOTION says first-page-only). Needs a first-render-only guard tuned on device.
- **Branded pull-to-refresh** (rotating play-mark) — RN `RefreshControl` isn't componentizable;
  needs a custom scroll-driven indicator validated at 60fps.
- **Tab-icon spring + halo + collapsing-hero parallax fine-tuning** — needs a custom TabBar and
  scroll-offset tuning measured on the reference Android.
- **Payment-success reputation-gain card + avatar-into-stack** — depends on the server rep delta
  from the refetched profile (not currently returned by verify); wire when that data exists.

## Backend/ops dependencies surfaced by M13 (deep links) — web repo + credentials

The mobile side (associatedDomains + Android intentFilters + validated routing + stash-resume) is complete. Universal/App Links won't verify on-device until:
- `public/.well-known/apple-app-site-association` and `assetlinks.json` are served from `gameground.net` (exact contents in `docs/DEEP_LINKS_WEB.md`), needing the Apple **Team ID** and the Android **release SHA-256 fingerprint** from `eas credentials`.
- Served with `application/json`, no redirect. Verify per the checklist in that doc.
Notification-tap routing works today without these; only externally-tapped web links depend on them.

| Item | Target | Notes |
|---|---|---|
| Streaks + named achievements (Weekend Warrior, Night Owl, 100 Matches, Captain/Legend) + XP framing | v1.1 | Decision 6. Server: achievement definitions, award engine hooked into existing mutation paths, user_achievements table. Client: AchievementsRail unlock states + celebration per MOTION.md §5. |
| Social graph (friends, follows, friend-activity feed) | v1.1+ | Explicit v1 non-goal. "Play again" (teammates-based) covers the near need. |
| Coach dashboard on mobile | v1.1 | Await coach demand signals post-launch (product PRD open question 2). |
| Weather on Home hero | v1 toggle | Build-time flag exists in M9A client brief; enabling = one open-meteo call (no key). Decide before M9A client half. |
| AI recommendations screen (/api/ai/recommend) | v1.1+ | v1 non-goal until mobile usage justifies rate-limit spend. |
| Live Activities / Dynamic Island / home-screen widgets | v2 | iOS-native surface work; revisit after launch metrics. |
| Notification center (in-app grouped inbox) | v1.1 | v1 ships OS notifications + per-category toggles only (M12). |
| Voice search | v2 | Placeholder-level idea from design prompts; no v1 justification. |
| Sound design (subtle success sounds, mutable) | v2 | Haptics carry v1 feedback. |
| Play Integrity / App Attest on payment endpoints; certificate pinning | post-launch | S2 items — deliberately deferred (solo-maintainer outage risk). |
| Light theme | v2 decision | Kit is dark-native (product PRD 6.9). |

## Resolved blockers

**Razorpay SDK / New Architecture — RESOLVED (Decision 10, 26 Jul 2026).** `react-native-razorpay`
is unsupported on RN 0.86 New Arch (bridgeless-only), so v1 uses the **hosted Razorpay Standard
Checkout in a WebView** (`react-native-webview`, New-Arch-safe), wired behind the unchanged
`openCheckout` seam (`src/lib/razorpay.tsx`). Remaining work is device verification only
(test-mode payment, Android UPI intent, one live ₹1) — the same gate any payment integration has.
