# Game Ground Mobile — working rules

Expo (SDK 57) / React Native app for gameground.net. **There is no new backend** — every read and
write goes to the production Next.js API at `https://www.gameground.net/api/*`. The server is
authoritative for prices, slots, eligibility, and reputation. The app never computes money.

## Read before you build

| Doc | When |
|---|---|
| `docs/GameGround_Mobile_App_PRD.md` | scope, phases, acceptance criteria |
| `docs/GameGround_Mobile_Developer_PRD.md` | conventions, API contracts, auth, payments (§ refs point here) |
| `docs/GameGround_Mobile_Milestones.md` | M0–M17 scope + exit criteria |
| `docs/DESIGN_SYSTEM.md` | BINDING — component anatomy, props, states, foundations |
| `docs/MOTION.md` | BINDING — anything that moves, celebrates, or vibrates |
| `docs/DECISIONS.md` | settled decisions; changing one needs a written scope change |

## Non-negotiable conventions (lint-enforced)

- **No color literals** outside `src/lib/tokens.ts`. Screens import tokens.
- **No raw `fetch`** outside `src/api/client.ts`.
- **No `expo-secure-store`** outside `src/lib/storage.ts`. Nothing security-relevant in AsyncStorage.
- **Screens compose, they don't fetch.** All data access via `src/hooks/queries/*`.
- **Icons only from `src/components/ds/icons.tsx`.** Never emoji, never a second icon family.
- **New screens are composed from the design system.** A screen needing a brand-new component
  triggers DESIGN_SYSTEM.md §10 governance, not improvisation.

## Session protocol

One milestone = one branch (`m05-games-browse`) = one focused stretch of sessions. Merge to `main`
only at milestone close, and only when every exit criterion passes **on a physical device**.

Scope-fence every session: "We are in M6. Read docs/GameGround_Mobile_Milestones.md M6 and dev PRD
§9. Implement task 3. Do not touch anything outside M6 scope."

## Commands

```bash
npm start          # expo dev server (needs a dev client build, not Expo Go — native modules)
npm run lint
npm run typecheck
npm test
```
