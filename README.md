# GameGroundApp

Native iOS + Android app (React Native / Expo SDK 57) for [gameground.net](https://www.gameground.net) — a hyperlocal sports marketplace in Kozhikode: coach booking, pickup games, camps, workshops, events, and a reputation leaderboard.

## Architecture in one line

A new client on the existing platform — no new backend. The app talks HTTPS + Bearer JWT to the production Next.js API (`https://www.gameground.net/api/*`), which fronts Prisma/Supabase, Razorpay, Cloudinary, and PostHog. The server is authoritative for prices, slots, eligibility, and reputation.

## Getting started

```bash
npm install
npm start        # requires an EAS dev client build — native modules mean Expo Go won't work
```

Checks: `npm run lint` · `npm run typecheck` · `npm test`

## Layout

```
app/          Expo Router routes (tabs, detail stacks, auth, profile)
src/api/      the only place network calls live — client.ts wraps every request
src/components/  ds · cards · chrome · checkout
src/hooks/    queries/ (one file per domain) + useAuth, useCheckout, usePush
src/lib/      tokens.ts (all colors/radii/type) · storage.ts (SecureStore) · env.ts
docs/         PRDs, design system, motion spec, milestones
```

Three conventions are lint-enforced: no color literals outside `src/lib/tokens.ts`, no raw `fetch` outside `src/api/client.ts`, no `expo-secure-store` outside `src/lib/storage.ts`. See [CLAUDE.md](CLAUDE.md) for the rest.

## Status

**M0 (Foundation & Scaffold) — code complete.** Every route is a token-styled placeholder; real screens land per milestone.

## Documents

| File | What it is |
|---|---|
| [docs/GameGround_Mobile_App_PRD.md](docs/GameGround_Mobile_App_PRD.md) | Product PRD — scope, goals, metrics, non-goals, screens. **Read first.** |
| [docs/GameGround_Mobile_Developer_PRD.md](docs/GameGround_Mobile_Developer_PRD.md) | Technical spec — setup, conventions, API contracts, auth, payments |
| [docs/GameGround_Mobile_Milestones.md](docs/GameGround_Mobile_Milestones.md) | M0 → M17 roadmap, dependency graph, exit criteria (~15 weeks) |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Design tokens, components, visual rules (binding) |
| [docs/MOTION.md](docs/MOTION.md) | Animation and transition spec (binding) |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decision log |
| [docs/BACKLOG.md](docs/BACKLOG.md) | Deferred items |
| [docs/GameGround_Claude_Code_Briefs.md](docs/GameGround_Claude_Code_Briefs.md) | Per-milestone build briefs for Claude Code sessions |
| [docs/GameGround_Claude_Code_Memory_Protocol.md](docs/GameGround_Claude_Code_Memory_Protocol.md) | How sessions carry context between milestones |

## Working rules

- One milestone = one branch (`m05-games-browse`). Merge to `main` only at milestone close.
- A milestone is closed only when every exit criterion passes **on a physical device**.
- Server-side milestones (M1, halves of M9A/M12) run in the web repo, not here.

**Owner:** Anaswer Ajay · Game Ground Pvt Ltd
