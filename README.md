# GameGround Mobile

Native iOS + Android app for [gameground.net](https://www.gameground.net) — a hyperlocal sports
marketplace in Kozhikode: coach booking, pickup games, camps, workshops, events, and a reputation
leaderboard.

**Owners:** [Sarang](https://github.com/sarangs1621) &
[Anaswer](https://github.com/imanaswer) · Game Ground Pvt Ltd

**Repository:** [github.com/sarangs1621/gameground-mobile](https://github.com/sarangs1621/gameground-mobile)

---

## Architecture in one line

**A new client on the existing platform — there is no new backend.** The app talks HTTPS + Bearer
JWT to the production Next.js API at `https://www.gameground.net/api/*`, which fronts
Prisma/Supabase, Razorpay, Cloudinary, and PostHog.

The server is authoritative for prices, slots, eligibility, and reputation. **The app never computes
money.** Where a client-side rule would duplicate a server rule, the client prefers the server's
answer and keeps a fallback for when the server doesn't send one — the shape used by the tier
ladder, the sport taxonomy, and post-auth routing.

## Stack

| | |
|---|---|
| Runtime | Expo SDK **54.0.36** · React Native **0.81.5** · React **19.1.0** |
| Language | TypeScript **~5.9.3**, strict |
| Routing | `expo-router` ~6.0.24 — typed routes + React Compiler both enabled |
| Data | TanStack Query v5 + AsyncStorage persister |
| Validation | Zod 4 (`src/api/schemas.ts`) |
| Motion | Reanimated 4 + Moti · `expo-haptics` |
| UI | FlashList · `@gorhom/bottom-sheet` · `react-native-svg` · `expo-image` |
| Observability | Sentry `~7.2.0` (SDK 54's pin) · PostHog |
| Payments | Razorpay via WebView (`src/lib/razorpay.tsx`) |

> `@sentry/react-native` is pinned to `~7.2.0` **on purpose** — it's what
> `expo/bundledNativeModules.json` pins for SDK 54. A launch crash on 7.11 is why. Don't bump it
> without reading Decision 28.

## Status

| Milestone | State |
|---|---|
| M0 – M15, plus M9A | Shipped |
| M1, server halves of M9A / M12 | Web repo, not here |
| M16 (QA, security audit, beta) | **Open** |
| M17 (store submission, go-live) | **Open** |

Beyond the documented roadmap, the app has since been **ported to light mode and made themeable**
(light + dark + System, Decision 24). `docs/GameGround_Mobile_Milestones.md` stops at M17 and does
not describe that work — the decision log does.

Two things are known-blocking a store submission, neither of them code:

- `APPLE_BUNDLE_IDS` must be set on the server, or `/auth/apple/mobile` fails closed with 503.
- The sending domain must be registered under Sign in with Apple → Email Communication, or mail to
  `@privaterelay.appleid.com` addresses bounces silently.

## Getting started

```bash
npm install
cp .env.example .env      # required — see below
npm start
```

**Expo Go will not work.** The app uses native modules (SecureStore, Apple Authentication,
notifications, Sentry), so you need a dev client:

```bash
npx expo prebuild         # /ios and /android are gitignored, generated per machine
npm run ios               # or: npm run android
```

### `.env` is not in the repo

`.env` is gitignored; a fresh clone gets `.env.example` only. `EXPO_PUBLIC_API_URL` is a hard
`required()` in `src/lib/env.ts` — **the app throws at import time without it.**

| Variable | Notes |
|---|---|
| `EXPO_PUBLIC_API_URL` | Required. `https://www.gameground.net` |
| `EXPO_PUBLIC_RAZORPAY_KEY_ID` | Publishable key id — safe as a repo *variable*, not a secret |
| `EXPO_PUBLIC_POSTHOG_KEY` | Optional; analytics no-ops when unset |
| `EXPO_PUBLIC_APPLE_AUTH_ENABLED` | **Opt-out.** Unset means *enabled* — only the literal `"false"` disables it |
| `SENTRY_DSN` | Not `EXPO_PUBLIC_`; reaches the app via `extra`, never the bundle |

Only `EXPO_PUBLIC_*` values reach the JS bundle. Anything else in `.env` is build-time only.

Two traps worth knowing, both of which have already cost a debugging session:

- **A placeholder counts as unset.** `SENTRY_DSN=https://...@sentry.io/...` is a *truthy string*, so
  a `!dsn` check passes it through and arms the native config plugin. Both `app.config.js` and
  `src/lib/sentry.ts` validate the DSN's **shape** instead, and a test asserts the two regexes stay
  character-identical (Decision 30).
- **`EXPO_PUBLIC_APPLE_AUTH_ENABLED` defaults to on.** Sign in with Apple is an App Store
  requirement (Guideline 4.8) while Google is offered, not a feature — so forgetting the flag must
  not silently build a rejection. The general rule: *a flag gating compliance defaults to compliant;
  only a flag gating a feature defaults to off* (Decision 31).

## Commands

```bash
npm start          # expo dev server
npm run ios        # expo run:ios      — needs a dev client build
npm run android    # expo run:android
npm run lint       # eslint .
npm run typecheck  # tsc --noEmit
npm test           # jest
```

Before a release cut: `bash scripts/release-check.sh` — exports the real bundle and greps it for
live keys and secrets.

## Layout

```
app/              Expo Router routes
  (auth)/         login · signup · forgot-password
  (tabs)/         home · games · coaches · discover · leaders
  game/ coach/ camp/ workshop/ event/   detail stacks
  profile/        index · edit · settings · payments · appearance
  onboarding · setup · search · upgrade-required
  _dev/           component catalog (dev only)

src/api/          the ONLY place network calls live — client.ts wraps every request
src/components/   ds · cards · chrome · checkout · auth · coach · social
src/features/     registration (one engine shared by camps/workshops/events)
src/hooks/        queries/ (one file per domain) + useAuth, useCheckout, usePush
src/lib/          tokens.ts · storage.ts · env.ts · checkout-machine.ts · sentry.ts · …
src/theme/        palette.ts (THEMES) · runtime.ts · ThemeProvider.tsx · animations.ts

docs/             PRDs, design system, motion spec, milestones, decision log
.maestro/         5 E2E flows
```

### Theming

`src/theme/palette.ts` holds both schemes; `runtime.ts` exposes `color`, `gradient`, `shadow`, and
`tier` as live proxies that re-read on scheme change. **Screens still import from
`src/lib/tokens.ts`** — it re-exports the runtime values, so the import surface never changed when
light mode landed.

`userInterfaceStyle` is `"automatic"` in `app.config.js`. That is not cosmetic: on iOS it writes
`UIUserInterfaceStyle` into Info.plist, and while it said `"light"` the OS reported light to
`useColorScheme()` regardless of the device setting. **Changing it needs a native rebuild** — a JS
reload cannot alter Info.plist.

## Conventions (lint-enforced, not suggestions)

- **No color literals** outside `src/lib/tokens.ts` / `src/theme/`. Screens import tokens.
- **No raw `fetch`** outside `src/api/client.ts`.
- **No `expo-secure-store`** outside `src/lib/storage.ts`. AsyncStorage is for the React Query cache
  only — never auth state.
- **Screens compose, they don't fetch.** All data access goes through `src/hooks/queries/*`.
- **Icons only from `src/components/ds/icons.tsx`.** Never emoji, never a second icon family.
- **New screens are composed from the design system.** A screen needing a brand-new component
  triggers DESIGN_SYSTEM.md §10 governance, not improvisation.

The first three are enforced by `eslint.config.js`; `__tests__/lint-rules.test.ts` proves the rules
still fire, so they can't rot silently.

## Auth

Three paths, all landing on the same `authStatus`-driven navigation so none of them can skip the
brand loader or the acknowledgement:

- **Email + password**
- **Google** — a browser handoff that reuses *the website's* OAuth client. There are deliberately no
  Google client ids in the app config; that's what keeps this flow rebuild-free.
- **Apple** — `expo-apple-authentication`, iOS only. `fullName` is forwarded on purpose: Apple
  releases the name on the **first** authorization only and never again.

Where a sign-in lands is decided by `src/lib/postAuthRoute.ts` from `{screen, isNewAccount}` — not
by which button was tapped. Social sign-in broke that old equivalence, because the server's
create-or-find is silent, so "Sign up with Google" is as likely to be a returning player.
`isNewAccount === null` reproduces the old behaviour exactly and is what every call hits today; the
routing corrects itself with no app release once the server sends `isNew` (Decision 32).

## Identity & deep links

- Bundle / package: `net.gameground.redesigned` (`.dev`, `.preview` for the other profiles)
- Scheme: `ggredesign` — deliberately **not** the original app's `gameground://`, since two apps
  claiming one scheme makes link resolution undefined
- Universal Links + App Links for `/games`, `/coaches`, `/camps`, `/workshops`, `/events`,
  `/leaderboard` — each needs its counterpart file on the web repo, see `docs/DEEP_LINKS_WEB.md`

**EAS Update is intentionally not configured.** Inheriting the original app's `updates.url` and
projectId would push the *original* app's JS bundle onto this one. Run `eas init` and re-add
`updates` when this app gets its own EAS project.

## Builds

Three EAS profiles in `eas.json` — `development` (dev client, internal, APK), `preview` (internal,
APK), `production` (autoIncrement). All three pin `APP_ENV`, the API URL, the Razorpay key id, and
`EXPO_PUBLIC_APPLE_AUTH_ENABLED`.

## CI

`.github/workflows/ci.yml`:

- **check** — `lint` + `typecheck` + `test` on **every branch** and every PR. The job used to match
  the `m[0-9]*` milestone naming only, which meant a differently-named branch was never checked
  anywhere but a laptop.
- **secret-grep** — `scripts/release-check.sh` on `main` and `release/*` only. Exports the real
  bundle and fails on a placeholder or test Razorpay key under production rules.

## Testing

**267 tests across 27 suites**, Jest + `jest-expo` + Testing Library. They cover the money path, the
checkout state machine, deep links, token/contrast invariants, schema parsing, Sentry scrubbing, and
the lint rules themselves.

`.maestro/` holds 5 E2E flows — **they have never been run.** They were written by reading screens,
not by driving a build. Treat the first run as a calibration pass; selector drift is expected and is
not evidence the app is broken.

## Documents

| File | What it is |
|---|---|
| [docs/GameGround_Mobile_App_PRD.md](docs/GameGround_Mobile_App_PRD.md) | Product PRD — scope, goals, metrics, non-goals, screens. **Read first.** |
| [docs/GameGround_Mobile_Developer_PRD.md](docs/GameGround_Mobile_Developer_PRD.md) | Technical spec — conventions, API contracts, auth, payments (§ refs point here) |
| [docs/GameGround_Mobile_Milestones.md](docs/GameGround_Mobile_Milestones.md) | M0 → M17 roadmap, dependency graph, exit criteria |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | **Binding** — component anatomy, props, states, foundations |
| [docs/MOTION.md](docs/MOTION.md) | **Binding** — anything that moves, celebrates, or vibrates |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Settled decisions. Changing one needs a written scope change. |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Deferred items |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Operational runbook |
| [docs/PERF.md](docs/PERF.md) | Performance budgets and findings |
| [docs/SOCIAL_AUTH_SETUP.md](docs/SOCIAL_AUTH_SETUP.md) | Google + Apple provider setup |
| [docs/DEEP_LINKS_WEB.md](docs/DEEP_LINKS_WEB.md) | The web-repo half of universal / app links |
| [docs/SYSTEM_LOGIC_AUDIT.md](docs/SYSTEM_LOGIC_AUDIT.md) | Client-vs-server logic audit |
| [docs/FIGMA_EXTRACTION.md](docs/FIGMA_EXTRACTION.md) | Reference extraction notes |
| [docs/GameGround_Claude_Code_Briefs.md](docs/GameGround_Claude_Code_Briefs.md) | Per-milestone build briefs for Claude Code sessions |
| [docs/GameGround_Claude_Code_Memory_Protocol.md](docs/GameGround_Claude_Code_Memory_Protocol.md) | How sessions carry context between milestones |
| [CLAUDE.md](CLAUDE.md) | Working rules for Claude Code sessions |

## Working rules

- **`main` is trunk** and the default branch. It is the only long-lived branch.
- A milestone is closed only when every exit criterion passes **on a physical device**. Jest cannot
  see the failures that matter most here — the original Sentry crash was native.
- Scope-fence every session: *"We are in M6. Read Milestones M6 and dev PRD §9. Implement task 3. Do
  not touch anything outside M6 scope."*
- Server-side work (M1, halves of M9A/M12) lives in the web repo, not here.
- Decisions are append-only. Reversing one is itself a decision — see 27 → 29.
