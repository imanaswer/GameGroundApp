# GameGroundApp

Planning and specification repo for the **Game Ground mobile app** — the native iOS + Android client (React Native / Expo) for [gameground.net](https://www.gameground.net), a hyperlocal sports marketplace in Kozhikode: coach booking, pickup games, camps, workshops, events, and a reputation leaderboard.

No app code yet. This repo holds the specs the build runs against.

## Architecture in one line

A new client on the existing platform — no new backend. The app talks HTTPS + Bearer JWT to the production Next.js API (`https://www.gameground.net/api/*`), which fronts Prisma/Supabase, Razorpay, Cloudinary, and PostHog. The server is authoritative for prices, slots, eligibility, and reputation.

## Documents

| File | What it is |
|---|---|
| [GameGround_Mobile_App_PRD.md](GameGround_Mobile_App_PRD.md) | Product PRD — scope, goals, metrics, non-goals, screens. **Read first.** |
| [GameGround_Mobile_Developer_PRD.md](GameGround_Mobile_Developer_PRD.md) | Technical spec — setup, conventions, API contracts, auth, payments |
| [GameGround_Mobile_Milestones.md](GameGround_Mobile_Milestones.md) | M0 → M17 roadmap, dependency graph, exit criteria (~15 weeks) |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design tokens, components, visual rules |
| [MOTION.md](MOTION.md) | Animation and transition spec |
| [DECISIONS.md](DECISIONS.md) | Decision log |
| [BACKLOG.md](BACKLOG.md) | Deferred items |
| [GameGround_Claude_Code_Briefs.md](GameGround_Claude_Code_Briefs.md) | Per-milestone build briefs for Claude Code sessions |
| [GameGround_Claude_Code_Memory_Protocol.md](GameGround_Claude_Code_Memory_Protocol.md) | How sessions carry context between milestones |

## Working rules

- One milestone = one branch (`m05-games-browse`) = one focused stretch of sessions. Merge to `main` only at milestone close.
- A milestone is closed only when every exit criterion passes **on a physical device**.
- Server-side milestones (M1, halves of M9A/M12) run in the web repo, not here.

**Owner:** Anaswer Ajay · Game Ground Pvt Ltd
