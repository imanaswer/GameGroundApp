# Game Ground Mobile — Milestone Roadmap (M0 → M17)

**Version:** 2.0 (Design Excellence) · **Date:** 10 July 2026
**Companion docs:** `GameGround_Mobile_App_PRD.md` (product) · `GameGround_Mobile_Developer_PRD.md` (technical — section references like §5.3 point there)
**Rule of the roadmap:** one milestone = one branch = one focused stretch of Claude Code sessions. A milestone is CLOSED only when every exit criterion passes on a physical device. No starting M(n+1) while M(n) has open exit criteria, unless marked parallel-safe.

---

## How to run this with Claude Code

1. **Repo context first.** Put both PRDs in `docs/` and create `CLAUDE.md` at repo root pointing to them + the conventions (§2.3 of dev PRD). Every session inherits the rules without re-explaining.
2. **One milestone per branch:** `m05-games-browse`, `m06-payments`, etc. Merge to `main` only at milestone close.
3. **Prompt pattern per session:** "We are in M6. Read docs/MILESTONES.md M6 scope and dev PRD §9. Implement task 3. Do not touch anything outside M6 scope." Scope-fencing is what keeps Claude Code from wandering.
4. **Exit criteria are the test list.** End each milestone by asking Claude Code to walk the exit criteria one by one and prove each (test, screenshot, or command output).
5. **Server milestones (M1, M12 server-half) run in the web repo**, not the mobile repo. Separate branches there.

---

## Dependency graph

```
M0 ─▶ M1 ─▶ M2 ─▶ M3 ─▶ M4 ─▶ M5 ─▶ M6 ─▶ M7 ─▶ M8 ─▶ M9 ─▶ M9A ─▶ M10 ─▶ M11
                                                                     (M10, M11 parallel-safe)
M9A server half can start any time after M1; client half needs M9
M12 (server half after M1; client half after M4)
M13 needs M4 · M14 needs M7–M11+M9A · M15 needs M14 · M16 needs all · M17 last
```

Product-PRD phase mapping: Phase 0 = M0–M4 · Phase 1 = M5–M8 · Phase 2 = M9–M9A–M11 + M13 · Phase 3 = M12, M14, M15 · Phase 4 = M16–M17. Total ≈ 15 weeks. September cut line: drop M9A client-half to fast-follow before dropping Workshops.

---

## M0 → Foundation & Scaffold

**Goal:** a running Expo app skeleton with the project's non-negotiables baked in before any feature code exists.

- Create Expo project (TypeScript, Expo Router) per dev PRD §2.2; commit folder structure §2.3 with placeholder files.
- `lib/tokens.ts` — full design-token set (§8.1), Instrument Serif loaded via expo-font.
- `lib/storage.ts` SecureStore wrapper (typed keys, the only expo-secure-store import site).
- ESLint rules: no inline hex colors in `app/`, no raw `fetch` outside `src/api/`, no AsyncStorage import outside allowed files.
- `app.config.ts` env plumbing + `eas.json` (development/preview/production profiles).
- **EAS development build** created and installed on physical iOS + Android (needed for Razorpay later — do it now).
- CI skeleton: typecheck + lint + jest on PR.
- Start Apple Developer **org** enrollment (D-U-N-S) + Play Console org account. External lead time — day one, not M17.

**Exit:** dev build runs on both physical devices showing a token-styled placeholder screen; CI green; lint rules proven by a failing test commit; Apple/Play enrollment submitted.

---

## M1 → Server: Security Blockers & Mobile Auth *(web repo)*

**Goal:** the API is safe and mobile-ready. Nothing in M2+ starts until this closes.

- Fix the two known payment-flow vulnerabilities + regression tests (S0.1).
- Verify demo auto-login and seeded credentials are dev-gated in production (S0.2).
- `RefreshToken` model + migration exactly per §5.3 (hash, familyId, deviceId, rotation, reuse-detection).
- `POST /api/auth/refresh` + `POST /api/auth/revoke`; login/register mint refresh tokens when `X-Client: mobile`; mobile access-token TTL 30 min.
- `POST /api/auth/google/mobile` (idToken verify) + `POST /api/auth/apple/mobile` (identityToken verify, `User.appleId` column).
- `MIN_MOBILE_VERSION` env + 426 check in `src/proxy.ts`.
- Vitest coverage: rotation, reuse→family-revocation, expiry, revoke-all.

**Exit:** all new endpoints pass tests; a replayed rotated token provably kills its family; payment-vuln regression tests green; deployed to production.

---

## M2 → API Client & Auth Flow *(mobile)*

**Goal:** the app can authenticate against production and stay logged in forever.

- `src/api/client.ts` per §4.1: envelope unwrap, headers (`X-Client`, `X-App-Version`, Bearer), 401→single-flight refresh→replay, 426 route, 429 backoff, timeouts.
- `api/auth.ts` + `useAuth()`; SecureStore persistence; cold-start session probe flow (§5.1).
- Login / Signup / Forgot-password screens (visual per kit GGAuth; DS components arrive in M3 — use token-colored primitives now, restyle in M3).
- Google Sign-In via expo-auth-session; Sign in with Apple.
- Logout = revoke + clear storage + clear query cache + reset PostHog identity.
- Jest: envelope parsing, refresh mutex (concurrent 401s → one refresh), 426/429 handling.

**Exit:** on both physical devices — signup, kill app, reopen (session survives), wait past 30-min access expiry (silent refresh works), logout then reuse old refresh token (rejected). Google + Apple sign-in complete end-to-end.

---

## M3 → Design System Components

**Goal:** every kit component ported 1:1, catalogued, and reviewable side-by-side against the design HTML.

- Port in order (§8.3): Button, Chip/ChipRow, Badge/TierBadge, Avatar/AvatarStack, Stars, SlotBar, Input, SearchBar, Header/HeroNav, StickyCTA, TabBar, Skeletons, CheckoutSheet (visual states only — logic in M6).
- Cards: CoachCard, GameCard, CampCard, WorkshopCard, EventCard (props shaped from kit `GG_DATA`).
- `app/_dev/components.tsx` catalog screen behind dev flag — **kept permanently**.
- Restyle M2's auth screens with the real components.

**Exit:** catalog screen matches kit visually for every component incl. pressed/disabled/empty states; zero inline colors (lint proves it); auth screens pixel-reviewed against kit.

---

## M4 → App Shell & Navigation

**Goal:** the full navigation skeleton — every screen reachable, all showing skeletons/placeholders.

- Splash with animated brand mark → route logic (onboarding | tabs).
- 3-slide onboarding, shown once (flag in storage).
- **5-tab bar (home, games, coaches, discover, leaders — Decision 5)** + detail stack + profile stack + create-game modal route + `upgrade-required` screen. Home is a placeholder screen until M9A; discover.tsx is a shell with the segmented control wired to empty segments until M9. Building the final tab structure now avoids remapping deep links mid-project.
- Screen/Scroll/Header chrome wrappers; skeleton loaders standard.
- PostHog + Sentry init (deferred post-first-frame, §13); Sentry beforeSend scrubber (S1.3).

**Exit:** can navigate to every route on both devices; onboarding shows exactly once; forced 426 (set MIN_MOBILE_VERSION above app version in a test env) blocks correctly; Sentry receives a test event with auth headers scrubbed.

---

## M5 → Games: Browse & Detail (read-only)

**Goal:** the flagship tab renders real production data beautifully.

- `hooks/queries/games.ts` + key factory; list with sport chips, search (300ms debounce), status filter; FlashList + expo-image/blurhash.
- Game detail: hero, MetaRows, AvatarStack of joined players, SlotBar, organizer TierBadge; sticky CTA present but inert.
- Pull-to-refresh; empty + error states per kit.

**Exit:** list scrolls 60fps on reference Android with 50+ items; filters/search hit the real API correctly; detail renders every field for free AND paid games; offline shows cached list + banner.

---

## M6 → Payments Engine

**Goal:** the money path, complete with every failure mode. The most carefully reviewed milestone in the project.

- `useCheckout(entityType, entityId, registration)` hook implementing §9.1 exactly: create-order → react-native-razorpay → verify → invalidate.
- CheckoutSheet wired: idle → processing → success/failure states from kit.
- Full failure matrix §9.2 incl. 409-as-success-equivalent.
- Reconciliation state §9.4: pendingOrderId persistence, history polling, cold-start resume, 5-min support fallback.
- FLAG_SECURE during checkout (S1.6); no PostHog autocapture on checkout screens.
- Integration tests (msw): every failure-matrix row + reconciliation resume.

**Exit:** test-mode payment succeeds on both platforms (UPI intent verified on Android with a real UPI app installed); airplane-mode-after-debit drill resolves via reconciliation; duplicate verify returns 409 handled as already-registered; integration suite green.

---

## M7 → Games: Actions

**Goal:** the complete game loop — join, pay, leave, waitlist, create, attendance.

- Join free (instant) / paid (M6 checkout) — confirmed state only after server truth (never optimistic).
- Leave with cutoff rules surfaced; waitlist join + promoted state.
- Create-game stepper (4 steps, per-step zod, venue/slot picker from `/venues` + `/venues/:id/slots`).
- Organizer attendance marking.
- Join-success micro-animation + haptic (full delight pass is M14; this one ships now — it's the core loop).

**Exit:** end-to-end on device: create game → second account joins (paid, test mode) → leave → waitlist → attendance; every product-PRD 6.2 AC checked off; app-open→joined under 60s measured in PostHog.

---

## M8 → Coaches: Learn Section

**Goal:** full coach discovery and booking.

- Directory with filters; coach profile with Overview/Batches/Photos/Reviews tabs; pinch-zoom lightbox (60fps with 20+ photos); WhatsApp deep link.
- Book batch → M6 checkout (`entityType: "coach"`, batchId in registration payload); booking appears in profile data.
- Post-booking review submission (server eligibility errors rendered inline).

**Exit:** product-PRD 6.3 ACs pass on both devices; booking round-trip visible without manual refresh; review rules enforced.

---

## M9 → Camps, Workshops & Events

**Goal:** the remaining catalog, built on one shared registration engine.

- Shared form engine + per-entity zod schemas (camp: child fields; workshop: audience-adaptive; event: team fields) per §9.1 registration payloads.
- Three directories + three details from shared card/detail components with section theming.
- Event announcements feed on event detail.
- All three checkouts through M6 (zero new payment code — if a new payment branch appears, the design is wrong; stop and fix).

**Exit:** one registration of each type completes in test mode on both platforms; product-PRD 6.4 ACs pass; form engine demonstrably shared (one file diff adds a hypothetical fourth entity).

---

## M9A → Home Experience *(Decision 5 — server half after M1; client half after M9)*

**Goal:** the personalized launch tab, per product PRD 6.10 and the approved Design Excellence v3 reference.

**Server (web repo):** `GET /api/home` — authed, per-user (not okCached), optional lat/lng; sections composed server-side in order (upcoming, startingSoon, popularTonight, forYou, playAgain via existing teammates logic, newCoaches); empty sections omitted; haversine distance annotation; parallel prisma queries; p95 < 300ms; vitest for shaping/omission/haversine.
**Client:** tab restructure finalization (Home becomes launch tab; old tab deep links map to Discover segments); `useHome` single-query screen; greeting, live ticker, UpNext hero (countdown + slot ring + avatar stack), compact-card rails with "See all" pre-filtered tap-through; contextual location card (never a launch prompt, denial remembered); new-user feed + "Set your sports" card; funnel analytics from Home.

**Gate:** Anain sign-off on the built Home + 5-tab bar (v3 reference is the mock); every 6.10 AC passes on both devices; new-account feed sane; all legacy deep links resolve via Discover mapping.

---

## M10 → Leaders & Global Search *(parallel-safe with M11)*

- Leaderboard: players/organizers toggle, all-time/30d, podium top-3, own-rank pinned when outside top-100; animated filter transitions (no full-screen spinner).
- Search modal: debounced `/search`, grouped results, local recent searches.

**Exit:** pinned rank correct for a low-ranked test account; toggles animate; search reaches any entity in ≤ 2 taps from anywhere.

---

## M11 → Profiles *(parallel-safe with M10)*

- Profile: PlayerHeroCard, RankProgress, StatStrip, SeasonStrip, Overview/Games/Achievements/Settings tabs, ActivityTimeline, AchievementsRail.
- Edit: avatar picker (12 presets + initials), basic info, sports, contact, sticky save.
- Payments history screen (reused by M6 reconciliation).
- Settings: notification toggles (UI now, wired in M12), log out, **account deletion** (full GDPR flow + device hard-logout).

**Exit:** product-PRD 6.6 ACs pass; deletion verified against server (identifier rotation) and blocks re-login; edit changes reflect on web profile too.

---

## M12 → Push Notifications *(server half after M1; client half after M4)*

**Server (web repo):** `DeviceToken` model + register/unregister routes + `lib/push.ts` dispatcher with prefs filtering and DeviceNotRegistered cleanup; call sites: reminders cron, waitlist promotion, event updates, webhook settlement, tier change, game cancel (§10.1).
**Client:** contextual permission prompt (after first join/booking — never on first launch); token registration on app open; tap → deep-link routing; foreground toast; Settings toggles wired to `prefs`.

**Exit:** all 6 categories fire end-to-end to a real device; toggles provably gate server-side; token cleanup verified after app uninstall; announcement→device latency < 2 min.

---

## M13 → Deep Links & Web Handoff

- `.well-known` AASA + assetlinks in web repo; universal/app links for all entity URLs + leaderboard.
- Zod-validated link params (S1.9); auth-gated targets stash-and-resume after login.

**Exit:** tapping a gameground.net game link in WhatsApp opens the app to that game on both platforms; malformed links route home without crash; logged-out deep link resumes to target after login.

---

## M14 → Delight Pass (Animations & Haptics)

**Goal:** the "fun to use" requirement, executed against `docs/MOTION.md` as a literal checklist (dev PRD §8.2 is superseded).

- Screen transitions, shared-element card→detail, collapsing hero headers, search-bar morph, tab cross-fades, list-entrance stagger (first page only), press-compress audit on every touchable.
- Tier-up full-screen moment (badge spring + confetti); extended payment success (check draw-on → confetti → reputation-gain card → avatar joins stack); verification timeline in checkout; count-ups, countdown ring, live ticker; branded pull-to-refresh.
- Haptics map (success/warning/selection) via `lib/haptics.ts`.
- Reduced-motion audit: every animation has a compliant fallback.

**Exit:** every MOTION.md row implemented; reduced-motion walkthrough recorded; no interaction below 55fps on reference Android; tier-up demo triggered via test account.

---

## M15 → Performance & Offline Hardening

- Cold-start budget < 2.5s on reference Android (measure, then cut: init deferral, prefetch tuning).
- FlashList audit (no blank cells), image cache audit, bundle-size check < 40 MB.
- React Query persistence (24h, version-busted); offline banner + disabled-writes behavior everywhere.
- Bundle-secret grep wired into release script (S1.5).

**Exit:** all §13 budgets green with recorded measurements; airplane-mode app tour shows cached content everywhere with no crashes; secret-grep passes on a production export.

---

## M16 → QA, Security Audit & Beta

- Full manual matrix (interns): every product-PRD AC on iPhone + 2 Androids incl. one low-end.
- Security checklist S0–S1 audited item-by-item with evidence links (§12).
- Maestro E2E suite (5 flows, §14) green in CI.
- 15-person internal beta (TestFlight + Play internal) → fix cycle → ~50-user closed beta with real Kozhikode players.
- One **live ₹1 payment** per platform, then refund (phase-gate record).

**Exit:** crash-free ≥ 99.5% across beta; zero open S0/S1 items; zero P0/P1 bugs; parity checklist vs web signed off (Parvathy); design sign-off (Anain).

---

## M17 → Store Submission & Go-Live

- Store assets: screenshots from design kit, descriptions, privacy nutrition labels (iOS) + Data Safety form (Play) — declare PostHog/Sentry collection accurately.
- Review-readiness: demo reviewer account (server-side gated, not the dev demo flow), account-deletion visible, Sign in with Apple present.
- Submit both stores; respond to review; Play staged rollout 20→50→100 over ≥ 5 days gated on crash-free ≥ 99.5%; iOS phased release on.
- `docs/RUNBOOK.md`: rollback commands (Play halt, iOS pause, OTA republish), MIN_MOBILE_VERSION kill-switch procedure, on-call notes.
- Launch-day: web banner + WhatsApp/Instagram push to existing users; PostHog launch dashboard (installs, D1, payment success, crash-free).

**Exit:** live on both stores at 100% rollout; runbook tested with one rehearsed OTA rollback; day-30 metric review scheduled.

---

## Scope-change protocol

Any feature request mid-milestone goes to a `BACKLOG.md` line with a target milestone — it does not enter the current branch. Moving an item into scope requires a one-line entry in the decision log (product PRD §12). This is the discipline that keeps a solo build shippable.
