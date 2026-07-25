# Game Ground Mobile — Claude Code Milestone Briefs

Each block below is a self-contained prompt. Paste ONE block into Claude Code at the start of a milestone, on that milestone's branch. Blocks assume `docs/GameGround_Mobile_App_PRD.md`, `docs/GameGround_Mobile_Developer_PRD.md`, `docs/GameGround_Mobile_Milestones.md`, `docs/MOTION.md`, and the approved reference build `docs/GameGround_Design_Excellence_v3.html` exist in the repo (put them there in M0, task 1).

Prompts marked **[WEB REPO]** are pasted into a Claude Code session in the gameground.net repo instead.

---

## ▶ M0 — Foundation & Scaffold

```
You are building Milestone M0 of the Game Ground mobile app on branch m00-foundation.
Read docs/GameGround_Mobile_Developer_PRD.md sections 2 and 8.1 before writing any code.

CONTEXT: Game Ground (gameground.net) is a live hyperlocal sports marketplace. This repo is a new
Expo React Native client for its existing Next.js API. Nothing exists yet except the docs/ folder.

OBJECTIVE: A running Expo skeleton with the project's non-negotiables enforced by tooling,
installable on physical iOS and Android via an EAS development build.

TASKS (in order):
1. Scaffold: npx create-expo-app with the default TypeScript + Expo Router template. Create the
   exact folder structure from dev PRD §2.3 (app/, src/api, src/components/{ds,cards,chrome,checkout},
   src/hooks/queries, src/lib, src/theme, assets/) with placeholder index files.
2. Install: react-native-reanimated, react-native-gesture-handler, expo-secure-store, expo-image,
   expo-haptics, expo-notifications, expo-auth-session, expo-apple-authentication, expo-linking,
   @tanstack/react-query, @tanstack/query-async-storage-persister, @gorhom/bottom-sheet, moti,
   react-native-razorpay, zod, posthog-react-native, @sentry/react-native, @shopify/flash-list.
   Use npx expo install for anything with a native module so versions match the SDK.
3. src/lib/tokens.ts: implement the token set from dev PRD §8.1 EXACTLY (color, radius, space, font).
   Load Instrument Serif via expo-font in the root layout. Export everything as const.
4. src/lib/storage.ts: typed SecureStore wrapper with keys gg.access, gg.refresh, gg.user,
   gg.deviceId, gg.onboarded, gg.pendingOrderId. Generate gg.deviceId (UUID) on first read.
   This file must be the ONLY place expo-secure-store is imported.
5. ESLint: add rules that fail the build on (a) hex color literals inside app/ and src/components/,
   (b) fetch( calls outside src/api/, (c) importing expo-secure-store outside src/lib/storage.ts,
   (d) importing @react-native-async-storage outside src/lib/. Use no-restricted-syntax /
   no-restricted-imports with overrides.
6. app.config.ts: read EXPO_PUBLIC_API_URL, EXPO_PUBLIC_RAZORPAY_KEY_ID, EXPO_PUBLIC_POSTHOG_KEY,
   SENTRY_DSN from env. Scheme "gameground". Bundle ids: net.gameground.app (both platforms).
   Version 0.1.0. eas.json with development / preview / production profiles per dev PRD §2.4.
7. Root layout (app/_layout.tsx): GestureHandlerRootView, QueryClientProvider (basic client for now),
   dark StatusBar, font loading gate. app/index.tsx renders a placeholder screen styled ONLY with
   tokens (bg color.bg, serif headline "Game Ground", red accent) to prove the token pipeline.
8. CI: .github/workflows/ci.yml running typecheck (tsc --noEmit), lint, and jest on every PR.
   Add one trivial jest test for storage.ts key typing so the suite is non-empty.
9. Build the EAS development client for both platforms (eas build --profile development) and
   print me the exact commands + what I need to do manually (Apple account login, device registration).

GUARDRAILS:
- Do not add any feature code, screens, or API calls. M0 is scaffold only.
- Do not use Expo Go assumptions anywhere — react-native-razorpay requires the dev client.
- Every color in the placeholder screen must come from tokens.ts (the lint rule must prove itself).

EXIT (prove each before we close M0):
[ ] npm run lint fails when I add color:"#ff0000" to app/index.tsx (demonstrate, then revert)
[ ] tsc, lint, jest all green locally and in CI
[ ] Dev build install instructions produced for both platforms
[ ] Placeholder screen screenshot shows serif font + correct colors
Also remind me (human tasks, not yours): start Apple Developer ORG enrollment (D-U-N-S) and
Play Console org account today.
```

---

## ▶ M1 — Server: Security Blockers & Mobile Auth **[WEB REPO]**

```
You are working in the gameground.net web repo on branch m01-mobile-auth. This is Milestone M1
of the mobile project: make the existing API safe and mobile-ready. The mobile client does not
exist against production until this ships.

Read first: src/lib/auth.ts, src/lib/api.ts, src/app/api/auth/login/route.ts,
src/app/api/payments/create-order/route.ts, src/app/api/payments/verify/route.ts, prisma/schema.prisma.

TASKS (in order):
1. SECURITY FIRST: I will point you at the two known payment-flow vulnerabilities we previously
   identified. Fix both, and write regression tests that fail on the old behavior. Do not start
   task 2 until these tests are green. [I'll provide the specifics in this session.]
2. Audit demo/seed credentials: confirm the demo auto-login (test@gameground.net) and any seeded
   passwords are impossible in production (NODE_ENV / env-flag gated at the route level, not just
   UI). If not, gate them. Confirm ADMIN_PASSWORD fallback "admin123" cannot survive to prod.
3. Prisma migration — RefreshToken model exactly as specified in mobile dev PRD §5.3:
   id, userId, tokenHash (sha256 of raw, unique), familyId, deviceId, expiresAt (+60d),
   revokedAt?, replacedBy?, createdAt, relation to User, indexes on userId and familyId.
   Also add: User.appleId String? @unique.
4. Token issuing: parameterize signToken with an expiry argument (default "7d" so web is untouched).
   Create src/lib/refresh.ts: mintRefreshToken(userId, deviceId, familyId?), rotateRefreshToken(raw),
   revokeFamily(familyId), revokeAllForUser(userId). Raw tokens: 48 random bytes base64url; only
   the sha256 hash is stored.
5. POST /api/auth/refresh: body { refreshToken, deviceId }. Flow: hash-lookup → reject if
   expired/revoked → REUSE DETECTION: if the row has replacedBy set, revoke the whole familyId and
   return 401 → otherwise rotate (revoke old, link replacedBy, insert successor same family) and
   return ok({ token, refreshToken }) where token is a 30-minute access JWT. Rate-limit with the
   existing auth bucket.
6. POST /api/auth/revoke (authed): body { all?: boolean, deviceId?: string } — revoke that
   device's families or all of the user's.
7. Mobile minting: in login, register, and the Google callback logic, when the request has header
   X-Client: mobile, ALSO mint and return refreshToken (new family), and issue the access token
   with 30m expiry instead of 7d. Web cookie behavior stays byte-identical.
8. POST /api/auth/google/mobile: body { idToken }. Verify against Google JWKS (google-auth-library),
   accept audiences from env GOOGLE_MOBILE_CLIENT_IDS (comma-separated iOS+Android ids). Reuse the
   existing find-or-create-user logic from the callback route (extract it into a shared function,
   don't duplicate). Return { user, token, refreshToken }.
9. POST /api/auth/apple/mobile: body { identityToken }. Verify against Apple JWKS
   (aud = net.gameground.app). find-or-create keyed on appleId; persist name/email from the first
   authorization payload. Same return shape.
10. Version gate: env MIN_MOBILE_VERSION. In src/proxy.ts, when X-Client: mobile is present and
    X-App-Version semver-compares below it, return 426 with the standard fail() envelope.
11. Tests (vitest): rotation happy path; reuse → family revocation; expired token; revoke-all;
    426 gate above/below/absent header; google/apple mobile routes with mocked JWKS.

GUARDRAILS:
- Zero behavior change for the web client. Prove it: existing test suite untouched and green.
- Never log or return raw refresh tokens outside the minting response.
- Follow the repo's existing ok/fail envelope and handleErr patterns exactly.

EXIT:
[ ] Payment-vuln regression tests green (and fail when the fix is reverted — demonstrate once)
[ ] Demo/seed access provably impossible in production config
[ ] All new endpoint tests green; npm run build clean
[ ] Deployed to production; curl transcript showing: mobile login returns refreshToken,
    /api/auth/refresh rotates, replayed old token gets 401 and kills the family
```

---

## ▶ M2 — API Client & Auth Flow

```
You are building Milestone M2 on branch m02-auth in the mobile repo. M1 is live in production.
Read dev PRD §3, §4, §5 fully before coding.

OBJECTIVE: the app authenticates against production and never logs the user out involuntarily.

TASKS (in order):
1. src/api/client.ts — the single network gateway:
   - request<T>(path, options): prefixes EXPO_PUBLIC_API_URL, sets Content-Type, X-Client: mobile,
     X-App-Version (from expo-constants), and Authorization: Bearer when an access token exists.
   - Parses the { ok, data | error, details } envelope; on ok:false throws
     ApiClientError { status, message, details }.
   - 401 → single-flight refresh: one shared in-flight promise; all concurrent 401s await it;
     on success replay each original request once; on failure clear tokens and emit an
     'auth:expired' event the auth provider listens to.
   - 426 → emit 'app:upgrade-required' (router will handle in M4; for now console.warn).
   - 429 → read rate-limit reset headers if present; exponential backoff w/ jitter for idempotent
     GETs only; NEVER auto-retry POST /auth/* or /payments/*.
   - Timeouts: 15s default, 30s for /payments/verify (AbortController).
2. src/api/auth.ts: login(email,password), register(payload), refresh(), revoke(),
   googleMobile(idToken), appleMobile(identityToken), me(). Types in src/api/types.ts:
   SessionUser { id,email,name,username,role,avatarUrl? } and AuthResponse { user, token, refreshToken }.
3. src/api/schemas.ts: transcribe LoginSchema and RegisterSchema from the web repo's src/lib/api.ts
   (username ^[a-z0-9_]+$ 3–20, password min 8, name 2–60). Comment each schema with its web source.
4. useAuth (src/hooks/useAuth.ts + provider in root layout): state machine
   booting → authed | guest. Boot: read tokens from storage → GET /auth/me → 200 authed;
   401 → refresh() → retry me(); network error → authed-with-cached-user + offline flag.
   login/register/google/apple write { access, refresh, user } to storage.
   logout(): best-effort revoke() → clear storage keys → queryClient.clear() → guest.
5. Screens under app/(auth)/: login.tsx, signup.tsx, forgot-password.tsx. Match the kit's GGAuth
   layout (dark bg, serif headline, red primary button, Google button with the 4-color G, Apple
   button on iOS). Use token-styled primitives now; they get swapped for DS components in M3.
   422 responses map details field-errors inline under inputs; 401 messages render verbatim
   (the server writes user-safe copy); 429 shows a countdown from the reset header.
6. Google: expo-auth-session PKCE with the native client IDs → POST googleMobile. Apple:
   expo-apple-authentication → POST appleMobile (iOS only; hide on Android).
7. Tests (jest + msw): envelope unwrap ok/fail; refresh mutex (fire 5 parallel 401s, assert exactly
   one /auth/refresh call and 5 replays); 426 event emission; 429 no-retry on POST; boot state
   machine paths.

GUARDRAILS:
- No screen or component may import fetch or client.ts directly — screens use api/* functions
  through hooks only (useAuth for this milestone).
- Tokens never appear in console.log, analytics, or error messages.

EXIT (on BOTH physical devices):
[ ] Signup → kill app → reopen → still logged in
[ ] Set access TTL artificially low in a test env (or wait 30m): a request silently refreshes
[ ] Logout → attempt refresh with the old token → 401, stays logged out
[ ] Google sign-in end-to-end; Apple sign-in end-to-end on iOS
[ ] Jest suite green incl. the 5-parallel-401 mutex test
```

---

## ▶ M3 — Design System Components

```
Milestone M3, branch m03-design-system. Read dev PRD §8 and open the design kit
(GameGround_Mobile_App.html) — the kit's design-system module (GameGroundDesignSystem_aafb1f),
GGIcons, GGChrome, GGCards source inside that HTML is the visual source of truth. Port 1:1,
do not improvise styling.

TASKS:
0. Read docs/MOTION.md §1 (tokens), §3 (touch feedback), §7 (loading) first — components are born
   with press-compress physics, shimmer skeletons, and entrance support built in, not retrofitted.
   src/theme/animations.ts (MOTION.md §1 tokens) and src/lib/haptics.ts (§4 map) are M3 deliverables.
1. src/components/ds/ — port in this order, each with typed props and pressed/disabled states:
   Button (primary red / secondary outline / ghost, loading spinner state),
   Chip + ChipRow (horizontal scroll, active = red fill),
   Badge + TierBadge (bronze/silver/gold/elite/pro — copy the kit's exact tier colors),
   Avatar (image | initials fallback) + AvatarStack (overlap, +N overflow),
   Stars (fractional fill geometry from the kit),
   SlotBar (fill %, threshold colors from kit: plenty/low/full),
   Input (label, error line, focus ring in red at 40% alpha),
   SearchBar, Eyebrow + SectionLabel.
2. src/components/chrome/: Screen (safe-area + bg), Header (title + left/right slots),
   HeroNav (transparent over image, back + share), MetaRow (icon + label + value),
   StickyCTA (bottom-pinned, safe-area aware, price slot + button slot),
   TabBar (6 items: coaches/games/camps/workshops/events/leaders — icons per kit GGIcons paths,
   active tint red, inactive textDim), Skeleton primitives (shimmer via moti).
3. src/components/cards/: CoachCard, GameCard, CampCard, WorkshopCard, EventCard. Shape props
   from the kit's GG_DATA demo objects. 20px radius, card bg, hairline border — all from tokens.
4. Icons: port the kit's Lucide-path icon set into src/components/ds/icons.tsx as
   <Ico d={...}/> path components (react-native-svg). Only the icons the kit uses.
5. src/components/checkout/CheckoutSheet.tsx on @gorhom/bottom-sheet: VISUAL states only —
   methods list (UPI/Cards/Netbanking/Wallets/Pay Later rows per kit), processing (spinner + copy),
   success (check + amount), failure (message + retry button). Drive via a state prop; no payment
   logic (that's M6).
6. app/_dev/components.tsx behind __DEV__: every component in every state, grouped with section
   labels, so I can review side-by-side against the kit. This screen is permanent.
7. Restyle the M2 auth screens with the real DS components.

GUARDRAILS:
- Zero hex literals outside tokens.ts (lint already enforces — keep it green).
- No new dependencies. react-native-svg via expo install if not present.
- If the kit and these instructions ever disagree, the kit wins — flag the discrepancy to me.

EXIT:
[ ] Catalog screen matches the kit for every component incl. pressed/disabled/empty (I will
    review screenshots side-by-side)
[ ] TierBadge renders all 5 tiers with kit-exact colors
[ ] CheckoutSheet cycles all 4 visual states via dev buttons
[ ] Auth screens now fully DS-built; lint green
```

---

## ▶ M4 — App Shell & Navigation

```
Milestone M4, branch m04-shell. Read dev PRD §2.3 (routes) and §7 (screen map).

OBJECTIVE: every route in the app exists and is reachable, rendering skeletons/placeholders.
After this milestone the app "feels" complete structurally.

TASKS:
1. Routing per §2.3: (tabs) group with the FIVE tabs (home, games, coaches, discover, leaders —
   Decision 5) using chrome/TabBar. home.tsx is a placeholder screen until M9A; discover.tsx is a
   shell with the animated segmented control and three empty segments until M9. Detail stack routes
   coach/[id], game/[id], camp/[id], workshop/[id], event/[id]; game/create as modal;
   profile/{index,edit,payments,settings}; search modal; upgrade-required. Deep-link map: legacy
   /camps, /workshops, /events tab targets resolve to the matching Discover segment.
2. app/index.tsx splash: brand mark (red circle + play triangle per the kit's SVG) with a scale+fade
   Reanimated intro, then route: !gg.onboarded → /onboarding; guest → /(auth)/login;
   authed → /(tabs)/games. Prefetch me() during the animation.
3. onboarding.tsx: 3 swipeable slides (Learn / Play / Connect — headline serif, body sans, kit
   imagery placeholders), skip button, sets gg.onboarded.
4. Each tab screen: Header + SearchBar/ChipRow where the kit shows them + a FlashList of skeleton
   cards (real data starts M5). Detail routes: HeroNav + skeleton body.
5. upgrade-required.tsx: blocking screen (no back), copy "Update Game Ground to continue",
   buttons deep-linking to the App Store / Play listing ids from app.config extra. Wire the
   client.ts 'app:upgrade-required' event to route here.
6. Wire 'auth:expired' event → router replace to /(auth)/login with a toast.
7. Observability init in root layout, deferred until after first frame (InteractionManager):
   Sentry (beforeSend strips Authorization headers, any string matching Bearer\s+\S+, and keys
   named *token*/*signature*) and PostHog (identify on auth, reset on logout). Add
   src/lib/analytics.ts with track(event, props) — event names mobile_<domain>_<action>.
8. Deep link scaffolding in src/lib/deeplinks.ts: parse gameground:// and https://www.gameground.net
   paths → typed route targets with zod-validated params; unauthenticated targets stash to storage
   and resume after login. (System-level universal links config lands in M13; handle the scheme now.)

EXIT (both devices):
[ ] Can reach every route by tapping through the app
[ ] Onboarding appears exactly once across reinstall-less restarts
[ ] Setting MIN_MOBILE_VERSION above the app version in a test env hard-blocks with the upgrade screen
[ ] Sentry test event arrives with auth header provably scrubbed
[ ] Splash → tabs cold path feels instant (no white flash; measure and report)
```

---

## ▶ M5 — Games: Browse & Detail

```
Milestone M5, branch m05-games-browse. Read dev PRD §3.3 (games endpoints), §6 (data layer), §7.

OBJECTIVE: the Games tab renders real production data at 60fps.

TASKS:
1. src/hooks/queries/keys.ts: key factory (games.list(filters), games.detail(id), me, leaderboard(...),
   coaches..., camps..., workshops..., events..., search(q), paymentsHistory) — arrays only, one file.
2. src/api/games.ts + src/hooks/queries/games.ts: list({ q, sport, skillLevel, cost, status }) →
   GET /api/games (staleTime 60s); detail(id) → GET /api/games/:id (staleTime 30s). Transcribe
   response types into api/types.ts from the actual API responses (I can run curl for you against
   production public endpoints if you need shapes).
3. Games tab: SearchBar (300ms debounce), sports ChipRow (All + the sports the API returns),
   status filter (Open / Recent), FlashList of GameCard with estimatedItemSize from the card height,
   expo-image with blurhash placeholder + recyclingKey, pull-to-refresh, empty state
   ("No games yet — create one?") and error state with retry per the kit.
4. game/[id]: hero image + HeroNav (share = WhatsApp share link to gameground.net/games/:id),
   title serif, MetaRows (venue+address, date/time formatted for Asia/Kolkata, duration, skill level,
   price or FREE badge), organizer row with Avatar + TierBadge, AvatarStack of joined players,
   SlotBar, description, rules list. StickyCTA present but disabled with "Joining arrives in M7"
   dev label.
5. Offline: verify the persisted-cache path renders the last list with the offline banner
   (persistence plumbing from §6.1 — add PersistQueryClient now, maxAge 24h, buster = app version).

GUARDRAILS:
- No mutations of any kind this milestone.
- All data through hooks/queries; screens contain zero fetch logic.

EXIT:
[ ] 60fps scroll with 50+ items on the reference Android (perf monitor screenshot)
[ ] Filters and search produce correct API calls (show the request log)
[ ] Detail renders correctly for a free game AND a paid game from production
[ ] Airplane mode: list renders from cache with banner; detail for a visited game renders too
```

---

## ▶ M6 — Payments Engine

```
Milestone M6, branch m06-payments. THE most consequential milestone. Read dev PRD §9 completely,
twice. Also read product PRD 6.7. The invariants there are hard rules.

OBJECTIVE: a single reusable checkout engine every paid feature will consume, with every failure
mode handled, tested against Razorpay TEST mode.

TASKS:
1. src/api/payments.ts: createOrder({ entityType, entityId }) → POST /api/payments/create-order
   (response: orderId, amountPaise, currency, keyId — trust ONLY these);
   verify(payload) → POST /api/payments/verify (30s timeout, never auto-retried);
   history() → GET /api/payments/history.
2. src/hooks/useCheckout.ts — a state machine hook:
   idle → creatingOrder → checkoutOpen → verifying → success | failure | reconciling
   API: const { state, start, retry, dismiss } = useCheckout({ entityType, entityId, registration,
   onSuccess }). start(): createOrder → RazorpayCheckout.open({ key, order_id, amount, currency,
   name: "Game Ground", prefill: { email, contact: user.phone }, theme: { color: tokens.color.red } })
   → on SDK success call verify with { razorpay_order_id, razorpay_payment_id, razorpay_signature,
   entityType, entityId, registration } → success: invalidate entity detail + list + me +
   paymentsHistory, fire haptic success, call onSuccess.
3. Failure matrix (dev PRD §9.2) implemented exactly:
   - SDK cancel code → back to idle silently (no error UI).
   - SDK payment-failed → failure state with server/SDK message + Try again (reuse order if the
     SDK allows re-open on same order_id; otherwise recreate).
   - verify 409 → treat as SUCCESS-equivalent: message "You're already registered — no duplicate
     charge", refetch entity, resolve to success state.
   - verify 4xx (signature/binding) → hard failure: kit failure state + Sentry event containing
     orderId ONLY (never payment_id/signature), support row.
   - verify timeout / network drop → reconciling.
4. Reconciling (§9.4): persist gg.pendingOrderId; poll history() every 10s up to 5min for that
   order → confirmed: flip to success + local notification "Payment confirmed"; unresolved at 5min:
   persistent "Still confirming" card with a WhatsApp support deep link containing the order id.
   On app cold start, if gg.pendingOrderId exists, resume the poll and show a non-blocking banner.
5. Wire CheckoutSheet (M3 visuals) to the state machine.
6. Privacy/security: while the sheet is mounted → expo-screen-capture preventScreenCaptureAsync
   (Android FLAG_SECURE), release on unmount; disable PostHog autocapture for checkout screens;
   analytics events limited to mobile_checkout_started/succeeded/failed/reconciling with
   entityType only (no amounts, no ids).
7. Dev harness: temporarily enable the Game detail StickyCTA for PAID games behind __DEV__ to
   drive real test-mode checkouts (full join wiring is M7).
8. Tests (jest + msw): every failure-matrix row; 409 path; reconciliation poll → confirm; poll →
   5min fallback; cold-start resume (mock storage); assert verify is called at most once per attempt.

GUARDRAILS (violating any = stop and ask):
- The client NEVER sends or computes an amount. Server numbers render as-is (paise → ₹ format only).
- No UI may claim success before verify (or 409, or webhook-reconciled history) says so.
- verify is never auto-retried; only explicit user retry restarts the flow.

EXIT:
[ ] Test-mode payment succeeds end-to-end on Android (UPI intent with a real UPI app installed)
    and iOS (test card) — recorded
[ ] Airplane-mode drill: enable airplane mode after SDK success, before verify → app enters
    reconciling → disable airplane mode → resolves to success via history/webhook
[ ] Replayed verify (run twice) → 409 handled as already-registered
[ ] Full msw suite green; screen capture blocked during checkout on Android (verified)
```

---

## ▶ M7 — Games: Actions

```
Milestone M7, branch m07-games-actions. Read product PRD 6.2 (ACs are the spec) and dev PRD §7.

OBJECTIVE: the complete game loop — join (free/paid), leave, waitlist, create, attendance.

TASKS:
1. src/api/games.ts additions matching the web API's game action routes (inspect the web repo's
   src/app/api/games/[id]/route.ts action contract and transcribe): join, leave, joinWaitlist,
   markAttendance, cancel. Mutations in hooks/queries/games.ts invalidating games.detail(id),
   games.list(*), me — nothing broader.
2. Game detail CTA logic:
   - free + open → "Join game" → join mutation → server-confirmed state → success micro-animation
     (check pop + haptic notificationAsync Success) — this one ships now, not in M14.
   - paid + open → StickyCTA shows price → useCheckout({ entityType:"game", entityId,
     registration:{ phone } }) → onSuccess refetch shows joined.
   - joined → "You're in" state + Leave option (confirm dialog surfacing the server's cutoff
     error verbatim if rejected).
   - full → "Join waitlist" → waitlisted state chip.
   - NEVER optimistic: every state change renders only after refetch.
3. game/create.tsx — 4-step stepper per the kit and the web create-game flow:
   Step 1 sport + title + skill level; Step 2 venue picker (GET /venues, venue cards) OR free-text
   location+address, then slot picker (GET /venues/:id/slots) when a venue is chosen; Step 3 date/time
   (validate against slot when applicable), duration, slots count, cost (Free / amount in ₹);
   Step 4 description + rules (add/remove rows) + review card. Per-step zod (transcribe
   CreateGameSchema from web src/lib/api.ts); server 422 details map onto the owning step's fields.
   Success → route to the new game detail.
4. Organizer view on own game: attendance sheet (player rows + present toggles) → markAttendance;
   cancel-game action with confirm (surfaces refund copy for paid games from server response).
5. Analytics: mobile_game_join_started/succeeded, mobile_game_created, funnel timestamp from
   app-open to join-success (for the <60s metric).

EXIT (two test accounts, both platforms):
[ ] Create paid game on device A → join+pay (test mode) on device B → leave → rejoin via waitlist
    after filling → organizer marks attendance
[ ] Every AC in product PRD 6.2 checked off individually
[ ] Cutoff-rule leave rejection shows the server message inline
[ ] PostHog shows the open→joined duration event
```

---

## ▶ M8 — Coaches: Learn Section

```
Milestone M8, branch m08-coaches. Read product PRD 6.3 and dev PRD §7.

TASKS:
1. api/coaches.ts + query hooks: list (sport/search filters), detail, reviews(list, create),
   booking create (inspect web /api/bookings contract and transcribe).
2. Coaches tab: ChipRow sports filter + SearchBar + CoachCard list (photo, name, sports badges,
   Stars + count, price range, location) — kit GGDiscovery layout.
3. coach/[id]: hero (facility photo) + HeroNav; header block (avatar, name, TierBadge if present,
   Stars, price range); tab bar Overview / Batches / Photos / Reviews:
   - Overview: bio, sports, experience, MetaRows (location, contact), WhatsApp CTA
     (toWhatsAppNumber format like the web, prefilled message with coach name).
   - Batches: batch cards (name, schedule, seats left via SlotBar, price) each with Book button.
   - Photos: grid → full-screen lightbox with pinch-zoom + swipe (react-native-gesture-handler +
     Reanimated; expo-image for cache). Must hold 60fps with 20+ images.
   - Reviews: Stars breakdown + review list; write-review sheet (stars + text) shown only when
     the server says the user is eligible — surface eligibility errors inline, don't pre-compute.
4. Booking flow: Book on a batch → useCheckout({ entityType:"coach", entityId: coachId,
   registration:{ batchId, participantName, phone, note? } }) per the web verify Body → success
   sheet → "View in profile" link (profile lands M11; route to a stub confirmation for now noted
   as TODO(M11)).
5. Analytics: mobile_coach_viewed, mobile_coach_booking_succeeded, mobile_review_submitted.

EXIT:
[ ] All product PRD 6.3 ACs pass on both devices
[ ] Lightbox 60fps with 20+ photos on reference Android
[ ] Booking (test mode) reflects on the web profile for the same account
[ ] WhatsApp deep link opens with prefilled text on both platforms
```

---

## ▶ M9 — Camps, Workshops & Events

```
Milestone M9, branch m09-catalog. Read product PRD 6.4 and dev PRD §7, §9.1 registration payloads.

OBJECTIVE: the remaining three sections through ONE shared registration engine. The design test:
adding a hypothetical fourth paid entity later should be a one-file diff.

TASKS:
1. api/{camps,workshops,events}.ts + hooks: list + detail each; events detail includes the
   updates/announcements array.
2. src/components/forms/RegistrationForm.tsx — schema-driven: takes a zod schema + field config,
   renders DS Inputs/selects, maps server 422 details to fields. Entity schemas in api/schemas.ts:
   camp { childName, childAge, phone }, workshop { participantName, participantAge,
   registrationType (audience-adaptive per the web workshop flow), phone },
   event { teamName, phone, note? } — transcribe exact field names from the web verify Body type
   and the web registration forms; field names must match the API byte-for-byte.
3. Directories: three SEGMENTS of the Discover tab (M4's segmented control goes live) reusing the
   shared card grid (CampCard/WorkshopCard/EventCard from M3), each with its section accent, plus
   registration-progress bars and "filling fast" states per MOTION.md §2/§6 and the v3 reference.
4. Details: shared detail scaffold (hero, MetaRows: dates, venue, price, capacity SlotBar where
   provided, description) + per-entity extras; event detail renders the announcements feed
   (newest first, timestamps).
5. Registration: StickyCTA → registration form sheet → useCheckout({ entityType, entityId,
   registration }) → success state with entity-appropriate copy. Free events (if entryFee 0)
   follow the same submit path minus checkout ONLY if the web API supports free registration —
   inspect first; if not, everything goes through checkout.
6. Analytics: mobile_<entity>_registration_succeeded.

GUARDRAILS:
- ZERO new payment code. If any of these flows seems to need a new branch in useCheckout,
  STOP and tell me — that's a design failure to fix, not code around.

EXIT:
[ ] One camp, one workshop, one event registration complete in test mode on both platforms
[ ] Product PRD 6.4 ACs pass (incl. announcements rendering)
[ ] Show me the diff that would add a fourth entity type — it should touch schemas.ts, one card,
    one route file, and nothing in payments
```

---

## ▶ M9A — Home Experience *(two halves — Decision 5)*

**Server half [WEB REPO]:**

```
Branch m09a-home in the gameground.net repo. One new endpoint powering the mobile Home tab.
Read mobile product PRD 6.10 for the ACs.

TASK: GET /api/home (authed, NOT okCached — per-user). Accepts optional lat/lng query params.
Returns { sections: [...] } where each section is { id, title, items: [...typed refs] } and
EMPTY SECTIONS ARE OMITTED server-side. Sections, in order:
1. upcoming — the user's next 5 commitments across gamePlayers (upcoming games), bookings,
   camp/workshop/event registrations, merged and sorted by datetime. Item: { type, id, title,
   imageUrl, at, venue }.
2. startingSoon — open games in the next 24h, soonest first, limit 10.
3. popularTonight — today's open games ranked by fill ratio (joined/slots), min 30% filled, limit 10.
4. forYou — open games + top coaches matching user.sports (fallback: all sports), limit 10.
5. playAgain — open games organized by or containing the user's teammates. Reuse the existing
   /users/:id/teammates internals — extract a shared fn, don't duplicate.
6. newCoaches — coaches created in last 30d, limit 6.
If lat/lng provided: annotate game items with distanceKm (haversine vs game coords where present)
and re-rank startingSoon by (time, then distance). Simple haversine — no PostGIS at this scale.
Implementation: ONE route, parallel prisma queries via Promise.all, select only card-level fields,
p95 < 300ms. Vitest: section shaping, empty-section omission, haversine.
GUARDRAILS: no schema changes; zero web-client impact; standard ok/fail envelope.
EXIT: tests green; deployed; curl transcript for a seeded user showing 4+ populated sections.
```

**Client half (mobile repo):**

```
Branch m09a-home-client. Requires M9 merged and /api/home live. Read product PRD 6.10 and
docs/MOTION.md §2, §5, §8 (live-data animation). The approved visual reference is
docs/GameGround_Design_Excellence_v3.html — match its Home screen. Anain's sign-off on the Home
layout and 5-tab structure must be confirmed before you start.

TASKS:
1. Home goes live as the launch tab (splash routes here); M4's placeholder replaced.
2. api/home.ts + useHome(lat?, lng?) — staleTime 120s; ONE query drives the entire screen.
3. Screen composition (existing DS/cards ONLY — no new visual language):
   - Time-aware serif greeting (Asia/Kolkata) + games-near-you count; avatar → profile;
     search icon → search morph.
   - Live activity ticker: rotating platform events from the home payload, MOTION.md §8 timing.
   - UpNext hero: image parallax on scroll, live countdown cells, slot-fill progress ring
     (SVG stroke-dashoffset), avatar stack with staggered pop-in, optional weather chip
     (build-time flag; open-meteo, no key).
   - Rails: horizontal FlashLists of `compact`-variant cards (add the prop — same anatomy,
     280pt width); SectionLabel + "See all" → owning tab pre-filtered; server order; omitted
     sections render NOTHING (never an empty rail).
4. Location (contextual): "See what's nearby" inline card → foreground permission → distanceKm
   chips. Denied → flag stored, card never returns. NEVER a launch prompt.
5. New-user path: feed works with only startingSoon + newCoaches; one-time dismissible
   "Set your sports" card → profile sports picker.
6. Analytics: mobile_home_viewed, mobile_home_rail_tap {section}; home_open → detail → join
   funnel (the <60s metric now starts at Home).
EXIT:
[ ] 5-tab structure final; every legacy deep link resolves via the Discover mapping
[ ] Seasoned account: 4+ rails; brand-new account: sane feed + setup card
[ ] Hero countdown/ring accurate and live; rail tap-through correct for every section
[ ] Location grant shows distances; deny path never asks again
[ ] Anain sign-off recorded on the BUILT screen (v3 file is the mock)
```

---

## ▶ M10 — Leaders & Global Search

```
Milestone M10, branch m10-leaders-search. Parallel-safe with M11. Read product PRD 6.5 and dev PRD §7.

TASKS:
1. api/leaderboard.ts + hook (staleTime 5min): scope players|organizers, window all|30d.
2. Leaders tab per kit GGCore.Leaders: podium for top 3 (center #1 elevated, medals gold/silver/
   bronze accents), rank rows 4–100 (rank, Avatar, name, TierBadge, score), toggle pills for
   scope + window with a layout animation on switch (LinearTransition) — no full-screen spinner,
   keep-previous-data while refetching.
3. Own-rank pinning: if the authed user is outside the visible 100, pin a highlighted row with
   their rank/score at the bottom (sticky). Confirm the API returns own-rank data; if it doesn't,
   check the web leaderboard implementation for how it derives it and mirror; if it truly can't,
   flag to me for a small server addition instead of hacking it client-side.
4. Search modal (route from every Header's search icon): debounced GET /api/search, grouped
   results (Games / Coaches / Camps / Workshops / Events) with type icons, tap → detail route.
   Recent searches stored locally (plain AsyncStorage is fine — non-sensitive; add the storage-lint
   exception explicitly). Empty and no-results states per kit.

EXIT:
[ ] Podium + rows match kit; toggles animate with data swap under 300ms perceived
[ ] A rank-4000 test account sees its pinned row correctly
[ ] From any tab: search → any entity type → its detail in ≤ 2 taps
```

---

## ▶ M11 — Profiles

```
Milestone M11, branch m11-profile. Parallel-safe with M10. Read product PRD 6.6 and dev PRD §7.
The kit's GGProfile module mirrors the CURRENT web profile — treat it as exact.

TASKS:
1. api/users.ts + hooks: profile(id), activity(id), teammates(id), updateProfile, deleteAccount.
   Inspect web /api/users/[id] + profile edit routes for exact contracts.
2. profile/index.tsx: PlayerHeroCard (avatar, name, username, TierBadge, tier RankProgress bar
   toward next tier), StatStrip (games played / organized / attendance% / reliability),
   SeasonStrip, tabs Overview / Games / Achievements / Settings:
   - Overview: UpcomingCard(s) (next bookings/games), ActivityTimeline from /activity,
     MotivationCard per kit.
   - Games: joined/organized history lists reusing GameCard compact variant.
   - Achievements: AchievementsRail per kit (derive from available stats/tier data).
   - Settings: notification category toggles (UI only — persisted locally now, wired to server
     prefs in M12 with a TODO(M12) marker), Payment history link, Log out, Danger zone.
3. profile/edit.tsx per kit GGEdit: avatar picker (12 preset assets + initials fallback option),
   name/username/bio/location, phone, sports multi-select chips, sticky Save bar (dirty-state
   aware), server 422 → inline field errors.
4. profile/payments.tsx: history list — entity, date, amount (server paise formatted), status
   chips incl. the "confirming…" state that M6's reconciliation links into.
5. Account deletion: type-DELETE-to-confirm sheet → deleteAccount → on success: clear tokens +
   query cache + PostHog reset → route to login. Must call the same GDPR endpoint web uses
   (identifier rotation server-side).
6. Tier-up detection: on any refetch of me, if tier changed upward, fire a placeholder full-screen
   moment (real animation in M14) + haptic; store last-seen tier in storage to avoid repeats.

EXIT:
[ ] Product PRD 6.6 ACs pass on both devices
[ ] Edit on mobile → change visible on web profile immediately
[ ] Deletion round-trip: account gone, old refresh token dead, re-login with same email behaves
    per server rules
[ ] Payment history shows a reconciled M6 test payment correctly
```

---

## ▶ M12 — Push Notifications *(two halves)*

**Server half [WEB REPO]:**

```
Branch m12-push in the gameground.net repo. Read mobile dev PRD §10.1.

TASKS:
1. Prisma: DeviceToken model exactly per §10.1 (userId, expoPushToken unique, platform, deviceId,
   prefs Json default {}, lastSeenAt, createdAt, index userId) + migration.
2. POST /api/push/register (authed): upsert on expoPushToken, refresh lastSeenAt, set platform/
   deviceId. DELETE /api/push/register: remove by expoPushToken for the authed user.
3. src/lib/push.ts: sendPush(userIds, category, { title, body, data }) — load tokens for users,
   filter where prefs[category] !== false, chunk 100/request to https://exp.host/--/api/v2/push/send,
   parse receipts, delete rows on DeviceNotRegistered. Categories: reminders, waitlist,
   event_updates, payments, tier, game_changes. PATCH /api/push/prefs to update prefs.
4. Call sites (minimal, surgical edits): cron/send-reminders (alongside the existing email),
   waitlist promotion path in the game join/leave logic, admin event-update creation route,
   payments/webhook settlement (category payments), reputationService tier change (category tier),
   games/[id]/cancel (category game_changes, notify joined players). Every payload includes
   data.url = the entity's gameground.net URL for deep-link routing.
5. Vitest: prefs filtering, chunking, DeviceNotRegistered cleanup (mock the Expo endpoint).

EXIT: tests green; deployed; a manual sendPush to my own token from a script reaches my phone.
```

**Client half (mobile repo):**

```
Branch m12-push-client. Read dev PRD §10.2–10.3.

TASKS:
1. src/hooks/usePush.ts: contextual permission — request ONLY after the first successful join or
   booking, with a pre-prompt sheet ("Want a reminder before your game?" → Yes → OS prompt).
   Never on first launch. On grant: getExpoPushTokenAsync → POST /api/push/register. Re-register
   (upsert) on every app open when permission is granted.
2. Notification handling: tap (killed/background/foreground) → route via lib/deeplinks.ts using
   data.url. Foreground: suppress the OS banner, show an in-app toast with the title, tappable.
3. Settings toggles (M11 UI) wired to PATCH /api/push/prefs; local state mirrors server truth.
4. Logout: DELETE /api/push/register before token clear (best-effort).
5. iOS: verify APNs entitlements in app.config; Android: default channel with red accent color.

EXIT (real devices):
[ ] All 6 categories received end-to-end (trigger each: reminder via cron test, waitlist promo,
    event announcement, payment webhook, tier change via admin override, game cancel)
[ ] Toggling a category off provably stops that category (server-side, shown in logs)
[ ] Notification tap from killed state lands on the right screen
[ ] Announcement→device under 2 minutes
```

---

## ▶ M13 — Deep Links & Web Handoff

```
Milestone M13, branch m13-deeplinks (plus one small web-repo PR). Read dev PRD §11.

TASKS:
1. [WEB REPO PR] public/.well-known/apple-app-site-association (appID = TEAMID.net.gameground.app,
   paths for /games/*, /coaches/*, /camps/*, /workshops/*, /events/*, /leaderboard) and
   assetlinks.json (package net.gameground.app + release SHA256 fingerprints — I'll supply
   fingerprints from EAS credentials). Served with correct content-type, no redirect.
2. Mobile: associatedDomains (applinks:www.gameground.net + apex) and Android intentFilters with
   autoVerify for the same hosts/paths in app.config.ts.
3. Harden lib/deeplinks.ts: zod param validation (cuid-shaped ids), unknown/malformed → home
   silently + Sentry breadcrumb; auth-gated targets stash-and-resume proven end-to-end.
4. In-app share actions everywhere share the https URL (never the custom scheme) so links work
   for users without the app.

EXIT:
[ ] WhatsApp-tap a game link on both platforms → app opens directly to that game (no browser hop)
[ ] Same link on a phone without the app → website (verified on one device/emulator)
[ ] Malformed id in a link → home, no crash, breadcrumb logged
[ ] Logged-out deep link → login → lands on the original target
```

---

## ▶ M14 — Delight Pass

```
Milestone M14, branch m14-delight. Read docs/MOTION.md IN FULL — implement it as a literal checklist (dev PRD §8.2 is superseded). The approved feel reference is docs/GameGround_Design_Excellence_v3.html; when a spec row is ambiguous, match the reference.
Everything runs as Reanimated worklets; JS-thread animation is a review-blocker.

TASKS:
1. src/theme/animations.ts finalized against MOTION.md §1 (built in M3, audited now); screen
   transitions via Expo Router options app-wide; SHARED-ELEMENT card→detail transitions
   (sharedTransitionTag on card image → detail hero) for Games/Coaches/Discover; collapsing hero
   headers with parallax; search-bar morph into the search screen; tab icon springs + halo.
2. Live-data animation pass (MOTION.md §8): count-ups (stats, leaderboard scores, slot numbers),
   Home countdown ring, activity ticker, avatar staggered pop-ins, slot-bar sweep, rank-change
   arrows; press-compress + ripple audit on EVERY touchable.
3. Tier-up moment (replaces M11 placeholder): full-screen takeover — scrim + blur, TierBadge
   spring with shine sweep, confetti burst, serif headline, staged fade-ups, dismiss on tap,
   haptic Heavy. One-shot per tier via stored last-seen tier.
4. EXTENDED payment success (MOTION.md §5): check draw-on → confetti burst → reputation-gain card
   ("+N pts" with animated progress toward next tier from real me data) → user avatar pops into
   the entity's stack; checkout verification TIMELINE during processing (create order → payment
   → verify steps completing live); join-success particle polish on the M7 micro-animation.
5. Branded pull-to-refresh: the play-mark rotating, all lists.
6. Reduced-motion: a useReducedMotion gate in animations.ts — transitions become fades,
   celebrations render static, staggers disabled. Audit EVERY animation through it.
7. Haptics map centralized in lib/haptics.ts (success / warning / selection) — replace all direct
   expo-haptics calls.

EXIT:
[ ] Every MOTION.md row demonstrably implemented (walk them one by one)
[ ] Reduced-motion ON walkthrough recorded — no motion beyond fades
[ ] Perf monitor during transitions ≥ 55fps sustained on reference Android
[ ] Tier-up fires exactly once per tier (trigger via admin reputation override, restart app,
    confirm no repeat)
```

---

## ▶ M15 — Performance & Offline Hardening

```
Milestone M15, branch m15-performance. Read dev PRD §13 — the budgets are pass/fail.

TASKS:
1. Measure first: cold-start (kill → interactive) on the reference Android over 5 runs; report
   before touching anything.
2. Cold-start diet to <2.5s: confirm Sentry/PostHog init is post-first-frame; splash prefetch
   limited to me + first games page; audit require-cycle warnings; check Hermes is on; lazy-load
   the create-game stepper and lightbox routes.
3. List audit: every feed on FlashList with tuned estimatedItemSize; zero blank cells on fast
   scroll (record); expo-image recyclingKey + contentFit everywhere; verify blurhash placeholders
   under 100ms.
4. Bundle: npx expo export + analyze; flag any dependency >200KB for justification; Android
   download size <40MB from the EAS build page.
5. Offline pass: PersistQueryClient config final (24h maxAge, app-version buster); walk every tab
   in airplane mode — cached content + banner, zero crashes; every mutating control disabled
   offline with a consistent hint.
6. Release script scripts/release-check.sh: expo export → grep dist/ for rzp_live, key_secret,
   AUTH_SECRET, sk_, and any 40+ char base64 blob matching token patterns → nonzero exit on hit.
   Wire into CI for release branches.

EXIT:
[ ] Cold start ≤2.5s median of 5 runs on reference Android (numbers recorded in docs/PERF.md)
[ ] Zero blank cells in recorded fast-scroll on all feeds
[ ] Android artifact <40MB
[ ] Airplane-mode full tour recorded, crash-free
[ ] release-check.sh passes on a production export and fails on a planted fake secret (demonstrate)
```

---

## ▶ M16 — QA, Security Audit & Beta

```
Milestone M16, branch m16-qa. Read dev PRD §12 and §14, product PRD section 6 (all ACs).

TASKS:
1. Maestro E2E: 5 flows per dev PRD §14 (signup→browse→join free game; login→book coach test
   payment; camp registration; profile edit; account deletion) against the preview build + test
   Razorpay. Wire into CI on main.
2. Generate docs/QA_MATRIX.md: every product-PRD AC as a checkbox row × device (iPhone, mid
   Android, low-end Android) — the interns execute this; produce it in a form they can tick.
3. Security audit: walk §12 S0.1–S1.9 one item at a time; for each, produce evidence (test link,
   code pointer, screenshot, or command output) into docs/SECURITY_AUDIT.md. Any item without
   evidence is OPEN and blocks M17.
4. Beta prep: EAS preview builds to TestFlight internal + Play internal track; crash-free and
   funnel dashboards in Sentry/PostHog; a docs/BETA_FEEDBACK.md intake template.
5. Fix cycle: I'll feed you beta bugs; P0/P1 fixed before widening to the ~50-user closed beta.
6. The live ₹1 payment on each platform happens here (I run it; you prepare a checklist of what
   to verify: order row, payment row, registration row, webhook log, refund path).

EXIT:
[ ] Maestro suite green in CI
[ ] QA matrix 100% executed, zero open P0/P1
[ ] SECURITY_AUDIT.md: every S0/S1 item evidenced and closed
[ ] Crash-free ≥99.5% across the closed beta window
[ ] Live ₹1 verified + refunded on both platforms
[ ] Parity sign-off (Parvathy) + design sign-off (Anain) recorded in the doc
```

---

## ▶ M17 — Store Submission & Go-Live

```
Milestone M17, branch m17-launch. Read product PRD section 9 Phase 4 and dev PRD §15.

TASKS:
1. Store metadata: titles, subtitles, descriptions (Kozhikode-first keywords: turf, pickup games,
   sports coaching Calicut), screenshots framed from the design kit screens for required device
   sizes, iOS privacy nutrition labels + Play Data Safety declaring PostHog (analytics, session
   replay) and Sentry (crash diagnostics) accurately, ATT: not required (no cross-app tracking) —
   verify no SDK triggers the requirement.
2. Review readiness: server-side-gated REVIEWER demo account (env-flagged credentials, NOT the dev
   demo flow), review notes explaining Razorpay = physical services (no IAP), account deletion
   path noted, Sign in with Apple visible.
3. Production builds: eas build --profile production both platforms; run scripts/release-check.sh;
   eas submit both stores.
4. docs/RUNBOOK.md: exact commands for Play halt-rollout, iOS phased-release pause, EAS Update
   rollback (republish previous update to production channel), MIN_MOBILE_VERSION kill-switch
   procedure, and who-to-page notes. Rehearse ONE OTA rollback on the preview channel and record it.
5. Rollout: Play staged 20→50→100 over ≥5 days, promotion gated on crash-free ≥99.5%; iOS phased
   release on. Launch-day checklist: web banner PR for gameground.net, WhatsApp/Instagram
   announcement copy, PostHog launch dashboard (installs, D1, payment success rate, crash-free).
6. Schedule the day-30 metric review against product PRD section 2 targets.

EXIT:
[ ] Approved and live on both stores, 100% rollout reached
[ ] Rehearsed OTA rollback recorded in RUNBOOK.md
[ ] Launch dashboard live with real data flowing
[ ] Day-30 review calendar entry exists with the metric table pre-filled
```

---

## Session hygiene (applies to every milestone)

- Start every Claude Code session with: "We are in M<n> on branch <branch>. Re-read the M<n> brief
  in docs/CLAUDE_CODE_BRIEFS.md and report which tasks are done/remaining before doing anything."
- Anything discovered mid-milestone that isn't in the brief → BACKLOG.md, not the branch.
- Close a milestone only by walking the EXIT checklist with evidence, then merge to main.
