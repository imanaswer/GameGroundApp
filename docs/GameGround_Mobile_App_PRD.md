# Game Ground Mobile App — Product Requirements Document

**Version:** 2.0 (Design Excellence) · **Date:** 10 July 2026 · **Owner:** Anaswer Ajay (CEO, Game Ground Pvt Ltd)
**Status:** Draft for approval
**Platforms:** iOS + Android, single codebase (React Native / Expo)
**Launch scope:** Full parity with gameground.net (all 6 sections) + personalized Home tab (Decision 5)
**Builder:** Anaswer + AI tooling (Claude Code), intern support for QA

---

## 1. Purpose & Background

Game Ground is live on the web at gameground.net as a hyperlocal sports marketplace for Kozhikode: coach booking, pickup games, camps, workshops, events, and a reputation-driven leaderboard. The web app is a PWA, but a native mobile app is the natural home for this product because the core loop (find a game tonight, pay, show up, build reputation) is inherently mobile: push notifications, one-tap UPI payments, location, and speed.

This PRD defines the v1 native app. It is not a redesign — the design kit (`GameGround_Mobile_App.html`) is the approved visual spec, and the existing Next.js API is the backend of record. The mobile app is a new client on the same platform.

**Guiding principle:** the app must feel *better* than the website on a phone in every measurable way, or it has no reason to exist.

---

## 2. Goals & Success Metrics

### Product goals
1. Move the majority of repeat bookings from web to app within 90 days of launch.
2. Make joining a game a sub-60-second flow from app open to payment success.
3. Use push notifications to lift attendance rate (a direct reputation-score input).

### Launch metrics (measure via PostHog, review at day 30/60/90)

| Metric | Target (day 90) |
|---|---|
| App installs (Kozhikode) | 1,500 |
| D7 retention | ≥ 25% |
| Bookings via app vs web | ≥ 50% of total |
| Payment success rate (order created → verified) | ≥ 92% |
| Crash-free sessions | ≥ 99.5% |
| Median app-open → game-joined time | < 60s |
| Push opt-in rate | ≥ 60% |

If a metric has no target it doesn't ship — every screen in section 6 maps to at least one of these.

---

## 3. Non-Goals (v1)

Explicitly out of scope. Anything here entering the build requires a written scope-change decision.

- **Admin console on mobile.** Admin stays web-only (`/admin`).
- **Coach dashboard on mobile.** Coaches manage bookings on web in v1; the app shows coach *profiles* only. (v1.1 candidate.)
- **In-app chat / DMs.** WhatsApp deep links remain the contact channel.
- **Live scores or match-tracking.**
- **AI recommendations screen.** The `/api/ai/recommend` endpoint stays web-only until mobile usage justifies the rate-limit spend.
- **iPad / tablet layouts.** Phone-first; tablets get the phone layout.
- **Offline booking.** Read caching yes (section 8), offline writes no.
- **Streaks and named achievements.** v1 launches with the tier/reputation system only; XP, streaks, and named achievements (Weekend Warrior, Night Owl, etc.) are v1.1 (Decision 6).
- **Social graph.** No friends, follows, or friend-activity feeds. "Play again" personalization uses the existing teammates relationship instead.

---

## 4. Users & Core Jobs

| User | Core jobs in the app |
|---|---|
| **Player** (primary) | Find a pickup game tonight → join & pay → get reminded → attend → climb tiers |
| **Parent** | Find a camp/workshop for their child → register & pay → receive updates |
| **Team captain** | Register a team for an event → pay → track event announcements |
| **Organizer** | Create a game → fill slots → mark attendance |
| **Coach (view-only in v1)** | Be discoverable; receive bookings created by players |

---

## 5. Platform & Architecture Decisions

These are decisions, not options. Changing any of them mid-build requires a decision log entry.

### 5.1 App stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK (latest stable) + React Native, TypeScript** | One codebase, OTA updates, EAS build/submit; you already live in the React/TS ecosystem so AI-assisted velocity is highest here |
| Navigation | **Expo Router** (file-based) | Mirrors your Next.js App Router mental model; deep links for free |
| State/data | **@tanstack/react-query** | Same library as web — port query hooks, don't reinvent |
| Animations | **react-native-reanimated + moti** | 60fps native-thread animations; moti for declarative micro-interactions |
| Gestures | **react-native-gesture-handler** | Bottom sheets, swipe actions |
| Bottom sheets | **@gorhom/bottom-sheet** | Checkout sheet, filters — matches the design kit's sheet patterns |
| Secure storage | **expo-secure-store** | Tokens in Keychain/Keystore, never AsyncStorage |
| Payments | **react-native-razorpay** (native SDK) | The web popup checkout does not exist on native; the design kit's checkout sheet maps to Razorpay's native UI |
| Push | **Expo Notifications** → FCM/APNs | Booking reminders, game updates, tier promotions |
| Analytics | **posthog-react-native** | Continuity with web analytics |
| Crash reporting | **Sentry (sentry-expo)** | Crash-free-sessions metric needs a source of truth |
| Images | **expo-image** | Caching + blurhash placeholders for coach/venue photos |
| Haptics | **expo-haptics** | Payment success, join confirmation, tier-up moments |

### 5.2 Backend strategy: same API, mobile-ready auth

The mobile app consumes the **existing Next.js API routes** — no separate backend. Two changes are required on the server first (these are P0 blockers, section 9):

1. **Bearer token auth.** Current auth issues a jose JWT in an httpOnly cookie. Native apps don't share the browser cookie jar reliably. Requirement: `/api/auth/*` endpoints must *also* return the JWT in the response body when the request carries an `X-Client: mobile` header, and `getSessionFromRequest` must accept `Authorization: Bearer <token>` in addition to the cookie. One code path, two transports.
2. **Refresh tokens.** A 7-day access token with no refresh means a forced re-login every week — unacceptable on mobile. Requirement: issue an access token (TTL 30 min) + refresh token (TTL 60 days, rotated on every use, revocable server-side). Store both in SecureStore. Add a `RefreshToken` model (hashed token, userId, deviceId, expiresAt, revokedAt) and `/api/auth/refresh` + `/api/auth/revoke` routes.

### 5.3 API versioning

All mobile calls send `X-Client: mobile` and `X-App-Version: <semver>`. The server gains a minimum-supported-version check (single env var); below it, the API returns `426 Upgrade Required` and the app shows a blocking "Update Game Ground" screen. This is cheap now and impossible to retrofit after users are on old builds.

### 5.4 OTA updates

EAS Update for JS-only changes. Rule: OTA is for fixes and copy, never for new payment logic — anything touching money ships through store review.

---

## 6. Feature Requirements

Screen inventory follows the approved design kit with one logged structural deviation (Decision 5): Splash → Onboarding → Auth → **5-tab shell (Home · Games · Coaches · Discover · Leaders)** → detail stack → Profile stack → Checkout sheet. Discover consolidates Camps, Workshops, and Events under a segmented control (7 tabs is a mobile anti-pattern). Profile lives behind the header avatar per the kit. The revised tab bar and the Home layout require Anain's design sign-off before their build milestones start; the approved visual reference for both is `docs/GameGround_Design_Excellence_v3.html`.

Each feature below lists acceptance criteria (AC). A feature is done when every AC passes on a physical Android device and an iPhone.

### 6.1 Onboarding & Auth

- Splash with animated brand mark (design kit: red play-button mark on #050505).
- 3-slide onboarding (Learn / Play / Connect), skippable, shown once.
- Sign up (email + password) and Log in; **Google Sign-In** via the existing `/api/auth/google` flow adapted for native (expo-auth-session).
- Forgot/reset password reusing existing endpoints.

**AC:**
1. New user completes signup → lands on Games tab in ≤ 3 screens.
2. Session survives app kill + device restart (refresh token flow).
3. Logout revokes the refresh token server-side, not just locally.
4. Auth endpoints remain behind the existing 5/min rate limit; the app surfaces the 429 with a friendly cooldown message, not a generic error.

### 6.2 Games (Play)

- List with sport filter chips, search, slot bars, tier badges on organizer avatars.
- Game detail: hero, meta rows (venue, time, price, slots), joined-player avatar stack, sticky Join CTA.
- Join free game (instant) / paid game (checkout sheet → verify → slot confirmed).
- Leave game respecting existing cutoff rules; waitlist join when full.
- Create game: the multi-step stepper from web, rebuilt with the kit's mobile patterns.
- Attendance marking for organizers.

**AC:**
1. Join-paid-game happy path completes in < 60s from tab tap (measured in PostHog).
2. Slot is *never* shown as confirmed before `/api/payments/verify` returns success.
3. Full game shows waitlist CTA; promotion off waitlist triggers a push.
4. Create-game validation errors appear inline per step, never as a blocking alert.

### 6.3 Coaches (Learn)

- Directory with sport filters and search; coach cards with rating stars, price, facility photo.
- Coach profile: Overview / Batches / Photos / Reviews tabs, photo lightbox with pinch-zoom, WhatsApp contact deep link.
- Book a batch → checkout sheet → booking confirmed.
- Leave a review post-booking (existing eligibility rules).

**AC:**
1. Photo gallery scrolls at 60fps with 20+ images (expo-image caching + blurhash).
2. Booking appears in Profile → upcoming within one refetch, no manual refresh.
3. WhatsApp deep link opens WhatsApp with prefilled text on both platforms.

### 6.4 Camps, Workshops, Events

- Directories live as segments of the **Discover tab** (segmented control per Decision 5); detail screens per the kit (shared card/detail components — build once, theme per section). Directory cards show registration-progress bars and "filling fast" states.
- Camp registration with child name/age; workshop registration with audience-adaptive fields; event team registration with team name + members.
- Event updates/announcements feed on event detail; new announcement triggers a push to registrants.

**AC:**
1. All three registration forms reuse one form engine with per-entity zod schemas mirrored from `src/lib/api`.
2. Registration state (pending payment / confirmed) is always derived from the server, never optimistically flipped.
3. An event announcement published in admin reaches registered users' devices in < 2 min.

### 6.5 Leaders

- Top-100 leaderboard, players/organizers toggle, all-time vs last-30-days, podium treatment for top 3, current user's own rank pinned if outside top 100.

**AC:**
1. Pinned own-rank row is correct even when the user is rank 4,000.
2. Toggling filters animates (layout animation) without a full-screen spinner.

### 6.6 Profile

- PlayerHeroCard with tier badge, rank progress bar, stat strip, season strip.
- Tabs: Overview / Games / Achievements / Settings (per design kit).
- Edit profile: avatar picker (12 presets + initials fallback), basic info, sports, contact.
- Settings: notification preferences, log out, and the danger zone — **account deletion in-app is mandatory** (Apple App Store Guideline 5.1.1(v) requires it; your web GDPR-delete endpoint already does the heavy lifting).

**AC:**
1. Tier-up moment gets a celebration animation + haptic (this is the retention hook — don't cut it).
2. Account deletion completes the same server flow as web (identifier rotation) and force-logs-out the device.
3. Notification preferences actually gate pushes server-side, not just locally.

### 6.7 Payments (cross-cutting)

- Native Razorpay checkout (UPI intent flow, cards, netbanking, wallets) launched from the sticky CTA on any paid entity.
- Order lifecycle mirrors web exactly: `create-order` (server-authoritative amount in paise) → native checkout → `verify` (HMAC signature check + order binding) → entity registration in one transaction.
- Payment history screen under Profile → Settings.
- Failure states: user-cancelled, signature-invalid, network-drop-after-debit (webhook reconciliation catches this — surface "payment received, confirming…" state polled from `payments/history`).

**AC:**
1. The client never sends an amount for anything — server computes charges from entity + type, always (this is already the web contract via `assertOrderBinding`; the app must not weaken it).
2. Replayed payment IDs return the existing 409 and the app treats it as already-registered, not as an error.
3. A payment that debits but loses network before verify resolves to confirmed within 5 min via webhook, with a push notifying the user.

### 6.8 Notifications (new capability)

| Trigger | Push |
|---|---|
| Booking/game reminder (replaces/augments `cron/send-reminders` email) | "Your game at {venue} starts in 3 hours" |
| Waitlist promotion | "A slot opened up — you're in!" |
| Event announcement | Title + first line |
| Payment reconciled via webhook | "Payment confirmed for {entity}" |
| Tier promotion | "You just hit {tier} 🏆" |
| Game cancelled by organizer | Cancellation + refund status |

Server work: `DeviceToken` model (userId, expoPushToken, platform, lastSeenAt) + a small dispatch helper called from the existing cron/webhook/mutation paths. Every push category is individually toggleable in Settings.

### 6.9 Platform table stakes

- Global search (the web ⌘K equivalent) as a search icon in headers.
- Deep links: `gameground.net/games/{id}` etc. open the app when installed (universal links / app links).
- Pull-to-refresh on every list; skeleton loaders (no spinners on first paint).
- Dark theme only in v1 — the design kit is dark-native; a light theme is a v2 decision, not a default.
- WhatsApp share sheets on all detail screens.

---

### 6.10 Home Experience *(added by Decision 5)*

- Launch tab. Time-aware serif greeting ("Good evening, {firstName}") with games-near-you count.
- Live activity ticker (recent joins, slots-left alerts, review highlights) rotating from real platform events.
- "Up next" hero card for the user's next commitment: live countdown, slot-fill progress ring, joined-avatar stack, venue/time, tap → detail. Optional weather chip (open-meteo, no key) is a build-time toggle.
- Server-composed rails in server order, empty rails omitted entirely: Upcoming, Starting Soon, Popular Tonight, For You (sport-matched games+coaches), Play Again (teammates-based), New Coaches.
- "Set your sports" inline setup card for users without sport preferences (dismissible, one-time).
- Optional location: inline "See what's nearby" card requests foreground permission contextually — never at launch; denial is remembered and never re-asked.

**AC:**
1. One `GET /api/home` request renders the whole screen; p95 server time < 300ms.
2. New user with zero history still gets a working feed (Starting Soon + New Coaches + setup card).
3. Hero countdown is accurate to Asia/Kolkata and ticks live; ring reflects real slot fill.
4. Every rail card tap-through lands on the correct detail; "See all" lands on the owning tab pre-filtered.
5. Home-open → game-joined funnel is instrumented (the <60s metric now measures from Home).

---

## 7. Design System (from the approved kit)

Tokens extracted from `GameGround_Mobile_App.html` — these are the contract; don't eyeball values:

- **Backgrounds:** #050505 (app), #0a0a0a (cards), #0d0d0d (elevated), borders rgba(255,255,255,0.06).
- **Brand:** #e63946 (primary red), #ff6b74 (red-light/hover), #b91c2d (red-deep/pressed).
- **Accents:** #eab308/#fbbf24 (gold — tiers, stars), #4ade80 (success), #1a2230 (info surface).
- **Type:** sans (system/Inter-class) for UI via `--gg-font-sans`; **Instrument Serif** for display headlines via `--gg-font-serif`.
- **Shape:** 20px card radius, sticky bottom CTAs, chip-row filters, hero-image detail headers with overlaid nav.
- **Components to port 1:1:** TierBadge, SlotBar, Stars, Avatar/AvatarStack, Chip, Badge, StickyCTA, SearchBar, ChipRow, checkout sheet states (methods → processing → success).

**Motion & interaction:** governed entirely by `docs/MOTION.md` (Decision 7) — the authoritative contract for timing/spring tokens, transitions, haptics, celebrations, empty states, loading rules, and the effects budget. The kit is the floor for layout/color/type; MOTION.md is the ceiling contract for how everything moves. Approved reference build: `docs/GameGround_Design_Excellence_v3.html`.

---

## 8. Non-Functional Requirements

### 8.1 Security (the "strong foundation" requirements)

**S0 — Pre-launch blockers on the existing API (before any mobile beta):**
1. **Close the two known payment-flow vulnerabilities in the web API.** The mobile app hits the same endpoints; shipping a new client on a known-vulnerable payment surface is not acceptable. This is the first task in Phase 0, before a single app screen is built.
2. Rotate any seeded/demo credentials out of production and confirm demo-login paths are disabled outside dev (`admin123`, `password123` seeds must not exist in prod).

**S1 — Mobile-specific:**
1. Tokens only in SecureStore (Keychain/Keystore). Nothing sensitive in AsyncStorage, logs, or Sentry breadcrumbs (scrub tokens in the Sentry beforeSend hook).
2. Refresh-token rotation with reuse detection: a reused (already-rotated) refresh token revokes the whole token family for that device.
3. TLS only; no cleartext traffic (Android networkSecurityConfig + iOS ATS defaults).
4. Razorpay signature verification stays 100% server-side (already true — keep it that way; the app never sees the key secret).
5. Screens with payment states set `FLAG_SECURE` on Android (no screenshots of checkout).
6. Rate-limit headers respected client-side with exponential backoff, so the app can't accidentally DoS your own Upstash budget.
7. No secrets in the app bundle. Public keys only (Razorpay key_id, PostHog key). Verified by a pre-release grep of the built bundle.
8. Dependency hygiene: `npm audit` clean at every release cut; Expo SDK kept within one major of latest.

**S2 — Nice-to-have, post-launch:** Play Integrity / App Attest attestation on payment endpoints; certificate pinning (deliberately deferred — pinning + solo maintenance is an outage risk).

### 8.2 Performance budgets

| Budget | Target |
|---|---|
| Cold start → interactive (mid-range Android) | < 2.5s |
| List scroll | 60fps, no blank cells |
| App size (Android download) | < 40 MB |
| Image loads | blurhash placeholder < 100ms, full image cached thereafter |

### 8.3 Reliability & offline

- React Query cache persisted to disk: last-fetched lists/details render instantly offline with a "you're offline" banner. Writes require connectivity and fail loudly + retryably.
- All mutations idempotent from the client's perspective (safe to retry on timeout — the server's unique constraints already back this for payments/registrations).

### 8.4 Accessibility

- Touch targets ≥ 44pt, labels on all interactive elements, dynamic type doesn't break layouts at 120% scale, contrast on #050505 backgrounds verified (the red-on-dark combos in the kit pass; keep body text ≥ #e7e9ee).

---

## 9. Build Plan — Phase Gates

Public launch is full parity, but the build order is phased so there's always a working app. Each phase has a gate; the next phase doesn't start until the gate passes. Timeline assumes you solo with AI tooling at Game Ground's usual pace, alongside the Trento move prep — the buffer in Phase 4 is deliberate.

### Phase 0 — Foundation (Weeks 1–2) 🔒
Server: fix the two payment vulnerabilities, Bearer + refresh-token auth, `X-Client` versioning check, `DeviceToken` model.
App: Expo project, design tokens + core components (TierBadge, SlotBar, cards, chrome), auth flow end-to-end, tab shell.
**Gate:** login on a physical device survives restart; refresh rotation works; payment vulns verified fixed with tests.

### Phase 1 — Core loop (Weeks 3–5)
Games list/detail/join/leave/waitlist, Coaches directory/profile/booking, native Razorpay checkout with full failure-state handling, Profile read-only.
**Gate:** a real ₹1 test payment completes end-to-end on both platforms, including the debit-then-network-drop reconciliation path.

### Phase 2 — Full catalog + Home (Weeks 6–9)
Discover tab (Camps, Workshops, Events + announcements), Leaders, create-game stepper, attendance, edit profile, account deletion, search, deep links, and the **Home experience (M9A: server endpoint + client tab)**.
**Gate:** every AC in section 6 (incl. 6.10) passes on both platforms; parity checklist against web signed off by Parvathy; Home + 5-tab bar signed off by Anain.

### Phase 3 — Delight & hardening (Weeks 10–12)
Push notifications (all 6 triggers), animation pass (tier-up, join success, transitions), performance pass against 8.2 budgets on a mid-range Android, Sentry + PostHog wired, security checklist S1 audited.
**Gate:** crash-free ≥ 99.5% across a 15-person internal beta (interns + co-founders + coaches); zero S0/S1 items open.

### Phase 4 — Beta & launch (Weeks 13–15)
Closed beta via TestFlight + Play internal track with ~50 real Kozhikode users, fix cycle, store assets (screenshots from the design kit, privacy nutrition labels, Play data-safety form), submit, launch.
**Gate:** store approval on both platforms + day-1 rollback plan written (staged rollout at 20% on Play).

**Total: ~15 weeks to public launch.** If Trento prep compresses your time in September, the pre-agreed cut line (in order): first drop the Home *client* tab to a fast-follow (keep the cheap server endpoint), then Workshops — decided by you in writing, not by drift.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Solo builder + visa/relocation timeline collide | High | Phase gates + pre-agreed cut line (section 9); interns own device-matrix QA from Phase 2 |
| Apple review friction (payments, account deletion, sign-in) | Medium | Google Sign-In present → Apple may require **Sign in with Apple**; budget it in Phase 2. Account deletion already in scope. Razorpay is fine (physical services, not digital goods — no IAP requirement) |
| Web popup-checkout assumptions leak into native flow | Medium | Payment ACs in 6.7 are the contract; native SDK path tested with real money in Phase 1 gate |
| Push fatigue hurts retention | Medium | Per-category toggles, hard cap of 1 reminder per booking, no marketing pushes in v1 |
| API changes on web break the app | Medium | `X-App-Version` + 426 upgrade gate; treat mobile as a consumer in your API review habit |
| Old app versions in the wild | Certain | EAS Update for JS fixes; staged rollouts; minimum-version kill switch from day one |

---

## 11. Open Questions (answer before Phase 0 ends)

1. **Sign in with Apple** — add it proactively (Apple usually mandates it when third-party login exists)? Recommendation: yes, it's ~1 day with expo-apple-authentication.
2. **Coach dashboard v1.1** — commit a date now or wait for coach demand signals post-launch?
3. **Play Store developer account** — is the Game Ground Pvt Ltd org account (not personal) created and D-U-N-S/verification started? Apple org enrollment takes 2–4 weeks; start it in Week 1, not Week 11.
4. Who signs off design parity per phase — Anain (CDO) as the design gatekeeper?

---

## 12. Decision Log

| # | Date | Decision | Owner |
|---|---|---|---|
| 1 | 10 Jul 2026 | React Native/Expo, single codebase, both platforms | Anaswer |
| 2 | 10 Jul 2026 | Launch scope = full web parity; phased internal build order | Anaswer |
| 3 | 10 Jul 2026 | Reuse existing Next.js API; Bearer+refresh auth added server-side | Anaswer |
| 4 | 10 Jul 2026 | Payment vulnerability fixes are a Phase 0 blocker | Anaswer |
| 5 | 10 Jul 2026 | Home/For-You tab ships in v1 (+2 weeks, ~15-week launch); tab bar restructured to 5 tabs (Home·Games·Coaches·Discover·Leaders), pending Anain sign-off | Anaswer |
| 6 | 10 Jul 2026 | Streaks, XP & named achievements deferred to v1.1; v1 launches with tier system only | Anaswer |
| 7 | 10 Jul 2026 | Design kit = floor for layout/color/type; docs/MOTION.md = binding interaction contract; external "redesign" prompts superseded by the CLAUDE.md Design Bar | Anaswer |
| 8 | 10 Jul 2026 | Design Excellence chosen over direct port after prototype comparison; GameGround_Design_Excellence_v3.html is the approved motion/UX reference artifact | Anaswer |
