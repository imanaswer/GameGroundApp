# Game Ground Mobile — Developer PRD (Technical Specification)

**Version:** 2.0 (Design Excellence) · **Date:** 10 July 2026
**Companion doc:** `GameGround_Mobile_App_PRD.md` (product requirements — read it first for scope, phases, and acceptance criteria)
**Audience:** any developer joining the project cold. After reading this you should be able to clone, run, and ship a feature without asking what the conventions are.
**Sources of truth:** the web repo (`GG-main`, referenced throughout by real file paths) and the approved design kit (`GameGround_Mobile_App.html`).

---

## 1. System Overview

The mobile app is a **new client on the existing platform**. There is no new backend. All reads/writes go to the production Next.js API at `https://www.gameground.net/api/*`.

```
┌─────────────────────┐         ┌──────────────────────────────────────────┐
│  Expo RN App        │  HTTPS  │  Next.js 16 (Vercel)                     │
│  (iOS + Android)    │────────▶│  src/app/api/* route handlers            │
│                     │  Bearer │  src/proxy.ts (Upstash rate limits)      │
│  expo-secure-store  │  JWT    │                                          │
│  react-query cache  │         │  Prisma 7 ──▶ Supabase PostgreSQL        │
│  react-native-      │         │  Razorpay (orders/verify/webhook)        │
│    razorpay SDK ────┼───┐     │  Cloudinary · Resend · PostHog · Claude  │
└─────────────────────┘   │     └──────────────────────────────────────────┘
                          │ native checkout      ▲
                          ▼                      │ webhook (X-Razorpay-Signature)
                    ┌───────────┐                │
                    │ Razorpay  │────────────────┘
                    └───────────┘
```

Key consequences of this architecture:

1. **The server is authoritative for everything** — prices, slots, registration state, reputation. The app renders server state; it never computes money or eligibility.
2. **The API already speaks mobile.** `getSessionFromRequest` (`src/lib/auth.ts`) accepts `Authorization: Bearer <token>` as a fallback to the cookie, and `login`/`register`/Google callback already return `token` in the JSON body. You can build the app against production auth **today**. The only new server work is refresh tokens (§5.3) and push token registration (§10).
3. **Two clients, one API.** Any change to a shared route must be tested against the web app too. Mobile-only behavior is gated on the `X-Client: mobile` header, never on user-agent sniffing.

---

## 2. Project Setup

### 2.1 Prerequisites

- Node 20+, npm
- Expo account + EAS CLI (`npm i -g eas-cli`), logged into the Game Ground org
- Xcode 16+ (iOS builds), Android Studio + a mid-range physical Android test device
- Access to: web repo, Razorpay dashboard (test mode), Supabase project, PostHog, Sentry

### 2.2 Bootstrap

```bash
npx create-expo-app gameground-mobile --template default   # TypeScript, Expo Router
cd gameground-mobile
npx expo install react-native-reanimated react-native-gesture-handler \
  expo-secure-store expo-image expo-haptics expo-notifications \
  expo-auth-session expo-apple-authentication expo-linking
npm i @tanstack/react-query @tanstack/query-async-storage-persister \
  @gorhom/bottom-sheet moti react-native-razorpay zod \
  posthog-react-native @sentry/react-native
```

Pin the Expo SDK in `package.json`; upgrades happen deliberately at phase boundaries, never mid-feature.

### 2.3 Repository layout (Expo Router)

```
gameground-mobile/
  app/                          # file-based routes (Expo Router)
    _layout.tsx                 # root: providers (QueryClient, Auth, PostHog, Sentry, theme)
    index.tsx                   # splash → routes to onboarding | (tabs)
    onboarding.tsx
    (auth)/
      login.tsx  signup.tsx  forgot-password.tsx
    (tabs)/
      _layout.tsx               # bottom tab bar (5 tabs, order: home, games, coaches, discover, leaders — Decision 5)
      home.tsx  games.tsx  coaches.tsx  discover.tsx  leaders.tsx
                                # discover.tsx hosts Camps/Workshops/Events under a segmented control
    coach/[id].tsx              # detail stack — pushed over tabs
    game/[id].tsx
    camp/[id].tsx
    workshop/[id].tsx
    event/[id].tsx
    game/create.tsx             # create-game stepper (modal presentation)
    profile/
      index.tsx  edit.tsx  payments.tsx  settings.tsx
    upgrade-required.tsx        # blocking screen for HTTP 426
  src/
    api/
      client.ts                 # fetch wrapper: base URL, headers, envelope parsing, refresh, 426
      auth.ts games.ts coaches.ts camps.ts workshops.ts events.ts
      leaderboard.ts payments.ts users.ts search.ts push.ts
      types.ts                  # response types mirrored from web (§4.4)
      schemas.ts                # zod schemas copied from web src/lib/api.ts (§4.5)
    components/
      ds/                       # design-system ports: TierBadge, SlotBar, Stars, Avatar,
                                #   AvatarStack, Chip, Badge, Button, Input, StickyCTA,
                                #   SearchBar, ChipRow, SectionLabel, Eyebrow
      cards/                    # CoachCard, GameCard, CampCard, WorkshopCard, EventCard
      chrome/                   # Screen, Header, HeroNav, MetaRow, TabBar, Skeletons
      checkout/                 # CheckoutSheet states: idle → processing → success/failure
    hooks/
      useAuth.ts useCheckout.ts usePush.ts useDebounce.ts
      queries/                  # one file per domain; query-key factory (§6.1)
    lib/
      tokens.ts                 # design tokens (§8.1) — the ONLY place colors/radii live
      storage.ts                # SecureStore wrapper (typed keys)
      haptics.ts analytics.ts sentry.ts deeplinks.ts
    theme/animations.ts         # shared Reanimated transitions & springs
  assets/                       # brand mark, onboarding art, avatar presets (12)
  app.config.ts                 # env-driven Expo config (scheme, bundle ids, plugins)
  eas.json                      # build profiles: development / preview / production
```

**Conventions (enforced in review):**
- No inline hex colors or magic numbers in screens — everything through `lib/tokens.ts`.
- Screens compose; they don't fetch. All data access via `hooks/queries/*`.
- No `AsyncStorage` for anything security-relevant. SecureStore only, via `lib/storage.ts`.
- Every network call goes through `api/client.ts`. No raw `fetch` in components, ever.

### 2.4 Environments

| Env | API base | Razorpay | Distribution |
|---|---|---|---|
| `development` | `http://<lan-ip>:3000` (local web repo) or preview | test key | dev client / simulator |
| `preview` | production API | test key | EAS internal (TestFlight / Play internal) |
| `production` | `https://www.gameground.net` | live key | stores |

Injected via `app.config.ts` + EAS build profiles (`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_RAZORPAY_KEY_ID`, `EXPO_PUBLIC_POSTHOG_KEY`, `SENTRY_DSN`). **Rule:** only `EXPO_PUBLIC_*` publishable values in the bundle. Before every release cut: `npx expo export && grep -r "rzp_live\|AUTH_SECRET\|key_secret" dist/` must return nothing.

---

## 3. Backend Contract — What Exists Today

Verified against the repo on 10 Jul 2026 (`Bacjup_july10.zip`).

### 3.1 Response envelope (`src/lib/api.ts`)

Every route returns exactly one of:

```jsonc
{ "ok": true,  "data": <T> }                                   // 2xx
{ "ok": false, "error": "<user-safe message>", "details": {} } // 4xx/5xx
```

- Zod failures → `422` with `details` = flattened field errors (use them for inline form errors).
- Prisma known errors are mapped to safe messages; `P2002` unique violations surface as `409` in payment/registration flows ("already registered").
- Unknown errors → generic `500`; the server never echoes internals. Render `error` verbatim; it is written to be user-facing.

### 3.2 Auth as implemented (`src/lib/auth.ts`)

- JWT: jose HS256, 7-day expiry, claims = `SessionUser { id, email, name, username, role, avatarUrl }`.
- `getSessionFromRequest`: checks the `gg_token` cookie first, then `Authorization: Bearer`. **Mobile uses Bearer; ignore cookies entirely.**
- `POST /api/auth/login` → `{ user, token }` (200). Wrong password and Google-only accounts both return 401 with distinct messages — show them as-is.
- `POST /api/auth/register` → `{ user, token }` (201). Username rule: `^[a-z0-9_]+$`, 3–20 chars; password min 8 (mirror in client zod for instant validation, but the server is the referee).
- `GET /api/auth/me` → current session user (use as the session-validity probe on cold start).
- Rate limits (`src/proxy.ts` via Upstash): auth routes 5/min per IP. On 429, read the reset info and show a countdown — do not silently retry.

### 3.3 Domain endpoints the app consumes

| Domain | Endpoints (all under `/api`) | Notes |
|---|---|---|
| Games | `GET /games` (`q`, `sport`, `skillLevel`, `cost`, `status=open\|completed\|all`) · `GET /games/:id` · `POST /games` · `POST /games/:id` (join/leave/waitlist actions) · `/games/:id/cancel` · `/games/:id/complete` | Public list hides `cancelled`/`archived`; `completed` visible 1h. Create validated by `CreateGameSchema` + venue/slot checks |
| Coaches | `GET /coaches` · `GET /coaches/:id` · `GET/POST /coaches/:id/reviews` · `POST /coaches/register` | Reviews have eligibility rules server-side |
| Camps | `GET /camps` · `GET /camps/:id` | Registration happens via payment verify (§9) |
| Workshops | `GET /workshops` · `GET /workshops/:id` | Audience-adaptive fields in `registration` payload |
| Events | `GET /events` · `GET /events/:id` | Detail includes updates/announcements feed |
| Leaderboard | `GET /leaderboard` (players/organizers, all-time / 30d) | Cached via `okCached` — CDN-cacheable, never send auth-dependent params |
| Home | `GET /home` (authed; optional `lat`,`lng`) | NEW (M9A). Server-composed sections in order (upcoming, startingSoon, popularTonight, forYou, playAgain, newCoaches); empty sections omitted; p95 < 300ms; haversine distance annotation when coords supplied |
| Profile | `GET /users/:id` · `GET /users/:id/activity` · `GET /users/:id/teammates` · profile edit + GDPR delete | Delete rotates identifiers; app must hard-logout after |
| Bookings | `GET/POST /bookings` | Coach batch bookings |
| Payments | `POST /payments/create-order` · `POST /payments/verify` · `GET /payments/history` | §9 in full |
| Search | `GET /search` | Powers the global search screen |
| Venues | `GET /venues` · `GET /venues/:id` · `GET /venues/:id/slots` | Create-game stepper venue/slot picker |
| Health | `GET /health`, `GET /ready` | Use `/health` for a startup connectivity probe |

Caching note: some public GETs use `okCached` (CDN `s-maxage`). Treat list data as possibly minutes-stale; anything correctness-critical (slots left before payment) is re-checked server-side at order/verify time, so do not build client logic that assumes list freshness.

### 3.4 Things the app must NOT touch

`/api/admin/*` (separate admin JWT, 60-min sessions), `/api/cron/*` (CRON_SECRET bearer), `/api/ai/recommend` (v1 non-goal). The API client should not even have functions for these.

---

## 4. API Client Layer (`src/api/client.ts`)

### 4.1 Required behavior

```ts
// Every request:
headers: {
  "Content-Type": "application/json",
  "X-Client": "mobile",
  "X-App-Version": Constants.expoConfig.version,   // semver
  ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
}
```

1. **Envelope unwrapping.** Parse `{ok, data|error, details}`; throw a typed `ApiClientError { status, message, details }` on `ok:false`. Components never see raw responses.
2. **401 handling.** On 401: attempt one refresh (§5.3); if refresh succeeds, replay the original request once; if it fails, clear tokens → route to `(auth)/login`. Concurrent 401s share a single in-flight refresh promise (mutex) — never fire parallel refreshes.
3. **426 handling.** Route to `upgrade-required` (blocking, no dismiss), deep-link buttons to the store listings.
4. **429 handling.** Surface retry-after; exponential backoff with jitter for automatic retries; never auto-retry auth or payment verify.
5. **Timeouts.** 15s default; 30s for `payments/verify`. Timeout ≠ failure for verify — enter the reconciliation state (§9.4).
6. **Network state.** Wrap with NetInfo awareness; queued refetch on reconnect is handled by React Query's `onlineManager`.

### 4.2 Typed API modules

One module per domain re-exporting typed functions, e.g. `games.list(filters): Promise<GameSummary[]>`. All types live in `api/types.ts` and are transcribed from the web repo's route selects — when the web response shape changes, this file is the single place to update.

### 4.3 Zod on the client

Copy the relevant schemas from web `src/lib/api.ts` into `api/schemas.ts` (`RegisterSchema`, `LoginSchema`, `CreateGameSchema`, registration payload schemas). Use them for **pre-flight form validation only**; the server remains authoritative. Keep a comment header linking each schema to its web source line so drift is auditable.

---

## 5. Authentication — Implementation Spec

### 5.1 Client flow

```
cold start ──▶ storage.getTokens()
   ├─ none ──────────────▶ onboarding/login
   └─ present ──▶ GET /auth/me
        ├─ 200 ──▶ (tabs)                      // session valid
        ├─ 401 ──▶ refresh ─▶ retry /auth/me   // §5.3
        └─ network error ─▶ (tabs) with cached user + offline banner
```

- Store on login/register/google: `{ accessToken, refreshToken, user }` → SecureStore keys `gg.access`, `gg.refresh`, `gg.user`.
- `useAuth()` exposes `{ user, status, login, register, loginWithGoogle, logout }` and is the only writer of those keys.
- Logout: `POST /auth/revoke` (best-effort) → clear SecureStore → clear React Query cache → reset PostHog identity.

### 5.2 Google Sign-In (native)

Web flow is redirect-based (`/api/auth/google` → `/callback`). Native uses `expo-auth-session`:

1. App runs the Google OAuth PKCE flow with the app scheme redirect (`gameground://redirect`).
2. New thin server route `POST /api/auth/google/mobile` accepts `{ idToken }`, verifies it against Google's JWKS (audience = the app's OAuth client IDs), then reuses the existing find-or-create-user logic from the callback route, returning `{ user, token, refreshToken }`.
3. Add iOS + Android OAuth client IDs in Google Cloud Console (same project as web).

**Sign in with Apple** (required by App Store review because Google login exists): `expo-apple-authentication` → `POST /api/auth/apple/mobile` `{ identityToken }`, verify against Apple JWKS, same find-or-create pattern keyed on a new `User.appleId String? @unique` column. Apple only sends the name/email on first authorization — persist immediately.

### 5.3 Refresh tokens (new server work — the one real backend feature)

**Schema (Prisma migration):**

```prisma
model RefreshToken {
  id         String    @id @default(cuid())
  userId     String
  tokenHash  String    @unique          // sha256 of the raw token; raw is never stored
  familyId   String                     // rotation family — reuse detection
  deviceId   String                     // app-install UUID from the client
  expiresAt  DateTime                   // now + 60d
  revokedAt  DateTime?
  replacedBy String?                    // id of the successor token
  createdAt  DateTime  @default(now())
  user       User      @relation(fields: [userId], references: [id])
  @@index([userId])
  @@index([familyId])
}
```

**Endpoints:**

- `POST /api/auth/refresh` `{ refreshToken, deviceId }` →
  - hash lookup; must be unexpired and unrevoked;
  - **reuse detection:** if the token is already `replacedBy`-linked (i.e., previously rotated), revoke the entire `familyId` and return 401 — the family is considered stolen;
  - otherwise rotate: revoke old, insert new (same family), return `{ token, refreshToken }` with a **30-minute** access token.
- `POST /api/auth/revoke` (authed) `{ deviceId? }` → revoke this device's family (or all families with `all: true` for "log out everywhere").
- `login` / `register` / `google-mobile` / `apple-mobile` gain: when `X-Client: mobile`, also mint + return `refreshToken` (new family per login per device).

**Access-token TTL change:** mobile-issued access tokens use 30 min (pass TTL into `signToken`); web keeps its 7-day cookie unchanged. One signing path, parameterized expiry.

---

## 6. Data Layer

### 6.1 React Query conventions

- Query-key factory per domain: `keys.games.list(filters)`, `keys.games.detail(id)`, `keys.me`, `keys.leaderboard(scope, window)` — keys are arrays built in one file (`hooks/queries/keys.ts`); never inline string keys.
- `staleTime`: 60s for lists, 30s for details, 5 min for leaderboard, 0 for `payments/history` while a reconciliation poll is active.
- Mutations invalidate narrowly: joining a game invalidates `games.detail(id)`, `games.list(*)`, `keys.me` — not the whole cache.
- **Optimistic UI policy:** allowed for reversible cosmetics only (e.g., review like). **Never** optimistic for: join/leave, any registration, anything payment-adjacent. Those render server truth after invalidation (this enforces product AC 6.2.2 / 6.4.2).
- Persistence: `PersistQueryClient` + AsyncStorage (cached lists are non-sensitive public data) with `maxAge` 24h; buster = app version so schema drift self-heals on update.

### 6.2 Offline

- `onlineManager` wired to NetInfo. Offline: render persisted cache + `OfflineBanner`; all mutating buttons disabled with a tooltip-style hint. No write queueing in v1 (product non-goal).

---

## 7. Screen Implementation Map

Route → data → key components → design-kit source module (for 1:1 visual reference inside `GameGround_Mobile_App.html`).

| Route | Queries/Mutations | Components | Kit module |
|---|---|---|---|
| `index` (splash) | prefetch `me`, `games.list` | animated brand mark | GGCore.Splash |
| `onboarding` | — | 3-slide pager, skip | GGCore.Onboarding |
| `(auth)/login`, `signup` | `auth.login/register`, Google, Apple | Input, Button, GoogleG | GGAuth |
| `(tabs)/home` | `useHome(lat?,lng?)` — one query | Greeting, live ticker, UpNext hero (countdown + slot ring + AvatarStack), horizontal rails of compact cards, setup card | Design Excellence v3 (approved) |
| `(tabs)/games` | `games.list(filters)` | SearchBar, ChipRow(sports), GameCard, skeletons | GGCore + GGCards |
| `game/[id]` | `games.detail`, join/leave/waitlist mutations, `useCheckout` for paid | HeroNav, MetaRow, AvatarStack, SlotBar, StickyCTA | GGDetail |
| `game/create` | venues, `venues/:id/slots`, `games.create` | 4-step stepper, per-step zod validation | web create-game stepper plan |
| `(tabs)/coaches` | `coaches.list` | CoachCard (photo, Stars, price) | GGDiscovery |
| `coach/[id]` | `coaches.detail`, `reviews`, booking mutation | Tabs (Overview/Batches/Photos/Reviews), pinch-zoom lightbox, WhatsApp CTA | GGDetail |
| `(tabs)/discover` (Camps/Workshops/Events segments) | respective `list` per segment | segmented control (animated pill), shared card grid + registration-progress bars, section theming | GGDiscovery + Design Excellence v3 |
| `camp/[id]` etc. | `detail`, `useCheckout` | registration form (shared engine + per-entity schema), StickyCTA; event detail adds announcements feed | GGDetail |
| `(tabs)/leaders` | `leaderboard(scope, window)` | podium top-3, rank rows, pinned own-rank | GGCore.Leaders |
| `profile/index` | `users.me`, `activity` | PlayerHeroCard, RankProgress, StatStrip, SeasonStrip, tabs, AchievementsRail | GGProfile |
| `profile/edit` | update mutation | avatar picker (12 presets + initials), sports chips, sticky save, danger zone | GGEdit |
| `profile/payments` | `payments.history` | status-aware rows incl. "confirming…" | — |
| `profile/settings` | push prefs, revoke, delete | per-category toggles, delete-account flow | GGProfile.Settings |
| `search` (modal) | `search(q)` debounced 300ms | grouped results, recent searches (local) | web ⌘K |

The kit's demo data module (`GG_DATA`) shows the exact field shapes each component renders — use it as the component-prop reference, then adapt to real API types.

---

## 8. Design System Implementation

### 8.1 `lib/tokens.ts` (extracted from the kit — the contract)

```ts
export const color = {
  bg: "#050505", card: "#0a0a0a", elevated: "#0d0d0d",
  border: "rgba(255,255,255,0.06)",
  red: "#e63946", redLight: "#ff6b74", redDeep: "#b91c2d",
  gold: "#eab308", goldLight: "#fbbf24", goldDeep: "#a16207",
  success: "#4ade80", infoSurface: "#1a2230",
  text: "#e7e9ee", textDim: "rgba(231,233,238,0.64)",
} as const;
export const radius = { card: 20, chip: 999, input: 14, sheet: 28 } as const;
export const space = (n: number) => n * 4;
export const font = { sans: "system", serif: "InstrumentSerif" } as const; // load via expo-font
```

Tier colors, SlotBar thresholds, and Stars geometry: port directly from the kit's design-system module (`GameGroundDesignSystem_aafb1f`) — read the source in the HTML rather than approximating.

### 8.2 Motion — superseded by docs/MOTION.md

The animation table formerly in this section is superseded by **`docs/MOTION.md`** (Decision 7), the single authoritative motion contract: timing/spring tokens, the transition catalog (shared-element card→detail, collapsing heroes, search-bar morph, sheet physics), touch feedback, haptics map, celebration moments (incl. the extended payment-success sequence with reputation-gain card), live-data animations (count-ups, countdown ring, activity ticker), empty-state catalog, loading rules, accessibility gates, and the effects budget. The approved visual reference is `docs/GameGround_Design_Excellence_v3.html`. Rules that remain absolute here: worklets only (no JS-thread animation), reduced-motion honored globally, and anything below 60fps on the reference Android ships simplified.

### 8.3 Component port order (Phase 0)

`Button → Chip/ChipRow → Badge/TierBadge → Avatar/AvatarStack → Stars → SlotBar → Input → SearchBar → Header/HeroNav → StickyCTA → TabBar → Skeletons → CheckoutSheet`. Each gets a story-style demo screen behind a dev flag (`app/_dev/components.tsx`) so visual QA against the kit is side-by-side.

---

## 9. Payments — Full Sequence

### 9.1 Happy path

```
user taps StickyCTA (paid entity)
  1. POST /payments/create-order { entityType, entityId }
     ◀ { orderId, amountPaise, currency, keyId }        // amount is SERVER-computed
  2. RazorpayCheckout.open({ key: keyId, order_id: orderId,
       amount: amountPaise, currency, name: "Game Ground",
       prefill: { email, contact }, theme: { color: "#e63946" } })
     ◀ { razorpay_order_id, razorpay_payment_id, razorpay_signature }
  3. POST /payments/verify { razorpay_order_id, razorpay_payment_id,
       razorpay_signature, entityType, entityId, registration: {...} }
     — server: HMAC check + assertOrderBinding (order ↔ user ↔ entity ↔ amount)
       + registration insert, all in ONE transaction
     ◀ 200 → invalidate entity detail + me + payments.history → success animation
```

**Invariants (violating any of these fails review):**
- The client **never** sends an amount anywhere. `create-order` derives paise from the DB (`chargePaiseFor` in `payments/create-order/route.ts`); `verify` re-asserts the binding.
- No UI state says "confirmed/joined/registered" before `verify` returns 200.
- `registration` payload fields per entity mirror the web `Body` type in `payments/verify/route.ts` (childName/childAge for camps, teamName for events, participantName/Age + registrationType/batchId for workshops/coach, phone/note where applicable).

### 9.2 Failure matrix

| Failure | Signal | App behavior |
|---|---|---|
| User closes checkout | SDK rejects with cancel code | Sheet returns to idle; no error toast (intentional exit) |
| Payment failed at gateway | SDK error payload | Kit's failure state + "Try again"; new checkout reuses the same order if unexpired, else re-create |
| `verify` → 409 (P2002 duplicate) | `ok:false`, 409 | Treat as **success-equivalent**: "You're already registered — no duplicate charge." Refetch entity |
| `verify` → 4xx binding/signature | 400/422 | Hard failure state + Sentry event with orderId (never the signature); support copy with order ref |
| Debit succeeded, network died before/during verify | timeout / no response | → §9.4 reconciliation |

### 9.3 Webhook (server, existing)

`POST /api/payments/webhook` validates `X-Razorpay-Signature` and settles orders server-side independent of the client. The app never calls it; it's the safety net §9.4 leans on.

### 9.4 Reconciliation state

On verify timeout/network-drop: persist `pendingOrderId` locally → show "Payment received — confirming…" (non-blocking) → poll `GET /payments/history` (10s interval, 5 min cap) for that order's status. Webhook settlement flips it to confirmed → success UI + local notification. After 5 min unresolved: "still confirming" state with a WhatsApp-support deep link carrying the order ID. On next cold start, any stored `pendingOrderId` resumes the poll.

### 9.5 Platform notes

- `react-native-razorpay` is a native module → requires an EAS **development build**; Razorpay checkout does not run in Expo Go. Build the dev client in Phase 0 week 1.
- Android: UPI intent flow lists installed UPI apps — test on a device with GPay/PhonePe.
- iOS: no UPI intents; cards/netbanking/wallets paths must be first-class, not an afterthought.
- Test-mode cards/UPI in the preview build; one **live ₹1 end-to-end on both platforms** is the Phase 1 gate (then refund via dashboard).
- Android payment screens set `FLAG_SECURE` (expo-screen-capture `preventScreenCaptureAsync` while CheckoutSheet is mounted).

---

## 10. Push Notifications

### 10.1 Server (new work)

```prisma
model DeviceToken {
  id            String   @id @default(cuid())
  userId        String
  expoPushToken String   @unique
  platform      String   // "ios" | "android"
  deviceId      String
  prefs         Json     @default("{}")   // per-category booleans (§10.3)
  lastSeenAt    DateTime @default(now())
  createdAt     DateTime @default(now())
  user          User     @relation(fields: [userId], references: [id])
  @@index([userId])
}
```

- `POST /api/push/register` (authed) `{ expoPushToken, platform, deviceId }` — upsert on token; called on every app open (keeps `lastSeenAt` fresh).
- `DELETE /api/push/register` on logout.
- `src/lib/push.ts`: `sendPush(userIds, category, { title, body, data })` → filters by per-user `prefs[category]` → batches to Expo Push API (100/req) → handles `DeviceNotRegistered` receipts by deleting tokens.
- Dispatch call sites: `cron/send-reminders` (alongside existing Resend email), waitlist-promotion mutation, event-update creation (admin route), webhook settlement, reputation service tier-change, game cancel route.

### 10.2 Client

- `expo-notifications`: request permission **contextually** (after first successful join/booking — "Want a reminder before your game?"), not on first launch. Opt-in rate is a launch metric; a cold-start permission prompt torpedoes it.
- Notification tap → deep link via `data.url` (e.g. `gameground://game/abc123`) handled in `lib/deeplinks.ts`.
- Foreground notifications render as an in-app toast, not a system banner.

### 10.3 Categories (each individually toggleable in Settings, mirrored to `prefs`)

`reminders` · `waitlist` · `event_updates` · `payments` · `tier` · `game_changes`. Hard rule from product: max 1 reminder per booking, zero marketing pushes in v1.

---

## 11. Deep Links & Universal Links

- Scheme: `gameground://` (auth redirects, notification taps).
- Universal/App Links for `https://www.gameground.net/{games,coaches,camps,workshops,events}/:id` and `/leaderboard`: host `apple-app-site-association` and `assetlinks.json` on the web app (`public/.well-known/`) — a small web-repo PR; coordinate with web deploy.
- Expo Router maps paths 1:1 to routes; unauthenticated hits to authed screens stash the target and resume post-login.

---

## 12. Security Implementation Checklist

Numbered S-items are release-blocking; CI/release checklist references them.

- **S0.1** Web payment-flow vulnerabilities fixed + regression-tested *before Phase 0 exit* (tracked in the web repo; mobile work does not start against a vulnerable payment surface).
- **S0.2** Production DB contains no seed credentials; demo-login flow disabled outside dev (`test@gameground.net` auto-login must be dev-gated).
- **S1.1** Tokens exclusively in SecureStore; `lib/storage.ts` is the only import site of expo-secure-store (lint rule).
- **S1.2** Refresh rotation + family reuse-detection live (§5.3), verified by an integration test that replays a rotated token and asserts family revocation.
- **S1.3** Sentry `beforeSend` scrubs `Authorization` headers, token strings, and payment signatures; PostHog autocapture disabled on checkout screens.
- **S1.4** No cleartext HTTP: iOS ATS default, Android `usesCleartextTraffic=false` (dev LAN exception only in the development build).
- **S1.5** Bundle-secret grep (§2.4) wired into the release script; failure blocks the cut.
- **S1.6** `FLAG_SECURE` on checkout (§9.5).
- **S1.7** Client backoff honors 429s; auth and verify are never auto-retried.
- **S1.8** `npm audit --omit=dev` clean at every release; Expo SDK within one major of latest.
- **S1.9** Zod-validate all deep-link params before navigation (malformed links route to home, never crash or inject).
- **S2 (deferred, documented):** Play Integrity / App Attest on payment endpoints; cert pinning intentionally not shipped (solo-maintainer outage risk > threat, revisit post-launch).

---

## 13. Performance Engineering

- **Reference device:** one mid-range Android (Redmi Note class) stays on the desk; every perf budget is measured there, not on a flagship or simulator.
- Cold start < 2.5s: defer PostHog/Sentry init to post-first-frame; splash prefetches `me` + first games page; Hermes enabled (default).
- Lists: `FlashList` for all feeds (estimated item sizes from kit card heights); images via `expo-image` with `recyclingKey`, blurhash placeholders, and explicit `contentFit`.
- Bundle: no moment/lodash-style heavy deps; icon set is the kit's own Lucide-path components (tree-shaken by construction); Android download < 40 MB checked at each EAS build.
- Perf pass exit criteria (Phase 3): systrace/Perf monitor shows no frame > 32ms during list scroll; navigation transitions ≥ 55fps sustained on the reference device.

---

## 14. Testing Strategy

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest + RTL | token/storage wrapper, api client (envelope, refresh mutex, 426/429), zod schemas, query-key factory |
| Integration | Jest + msw | auth flow incl. refresh rotation + reuse detection; checkout state machine incl. every §9.2 row and §9.4 resume-after-restart |
| E2E | Maestro | 5 flows: signup→browse→join free game; login→book coach (test payment); camp registration; profile edit; account deletion |
| Manual matrix | Interns, per phase gate | physical iPhone + 2 Androids (one low-end); checklist derived from product-PRD ACs |
| Server | Vitest in web repo | new endpoints: refresh/revoke, google/apple mobile, push register — added alongside the routes |

Payment E2E runs against Razorpay test mode in the preview build; the single live ₹1 check is manual and gate-recorded.

---

## 15. CI/CD & Release

- **EAS profiles:** `development` (dev client, LAN API), `preview` (internal distribution, prod API + test Razorpay), `production` (stores, live keys).
- **CI (GitHub Actions):** typecheck + lint + unit/integration tests on every PR; Maestro cloud smoke on `main`; `eas build --profile preview` nightly on `main`.
- **Versioning:** semver in `app.config.ts`; `X-App-Version` sent on every request; server `MIN_MOBILE_VERSION` env drives the 426 gate (new tiny check in `src/proxy.ts`).
- **EAS Update policy:** JS-only fixes and copy via OTA to production channel; anything touching payments, auth, or native modules ships as a store build. OTA is signed to channel + runtime version; never force a runtime mismatch.
- **Store rollout:** Play staged rollout 20% → 50% → 100% over ≥ 5 days with Sentry crash-free ≥ 99.5% as the promotion criterion; iOS phased release on.
- **Rollback:** Play halt-rollout + previous build; iOS phased-release pause + expedited fix; OTA rollback = republish previous update to the channel (document the exact commands in `docs/RUNBOOK.md` of the mobile repo before launch — mirror the web repo's ops-doc culture).

---

## 16. Definition of Done (per feature)

A feature/PR is mergeable only when:

1. Matches the design kit visually (side-by-side against the corresponding kit screen) including empty, loading (skeleton), and error states.
2. All product-PRD ACs for that feature pass on physical iOS + Android.
3. No new inline colors/magic numbers; data access only through query hooks; no raw fetch.
4. Errors render the server's `error` string; 422 `details` map to inline field errors.
5. Analytics events added for the feature's funnel step(s) (PostHog event names follow `mobile_<domain>_<action>`).
6. Unit tests for new logic; integration test if the feature touches auth or payments.
7. Reduced-motion behavior verified.
8. No regression on the reference-device scroll/startup budgets.

---

## 17. Week-1 Task List (make it concrete)

1. Create Expo project per §2; commit repo scaffolding + `tokens.ts` + CI skeleton.
2. Build the EAS development client (needed for Razorpay native module later — do it now, not in Phase 1).
3. Web repo PRs: refresh-token model + endpoints (§5.3), `MIN_MOBILE_VERSION` 426 check, `.well-known` link files (§11). Payment-vuln fixes land in this same window (S0.1).
4. Port first 6 design-system components with the dev demo screen.
5. Auth end-to-end on device: login → SecureStore → kill app → restore → refresh rotation → logout revoke.
6. Start Apple Developer **organization** enrollment (D-U-N-S) and Play Console org account — longest external lead time in the project.
