# Game Ground Mobile — Claude Code Memory & Context Protocol

Three pieces in this doc:
1. **`CLAUDE.md`** — drop at repo root. Claude Code reads this automatically every session; it contains the read-discipline and update-discipline rules.
2. **`docs/PROGRESS.md`** — the single state file. What's done, what's current, what's blocked. Created once, updated forever.
3. **The session prompt** — the short prompt you paste to start (or resume) any session.

Result: sessions start with ~3 small file reads instead of re-reading four PRDs, and every session ends with the state written to disk so the next session (or a compacted context) loses nothing.

---

## 1. `CLAUDE.md` (repo root — copy everything in this block)

```markdown
# Game Ground Mobile — Claude Code Rules

Expo RN client for the live gameground.net API. Solo builder + Claude Code. These rules are
mandatory in every session.

## CONTEXT DISCIPLINE — read the minimum, always in this order

1. `docs/PROGRESS.md` — ALWAYS first. It tells you the active milestone, current task, and
   which files matter. Never skip it, never assume you remember prior sessions.
2. The active milestone's brief ONLY — `docs/CLAUDE_CODE_BRIEFS.md` is large; read just the
   `## ▶ M<n>` section named in PROGRESS.md (grep for the heading, read that range).
3. Spec sections on demand only. `docs/GameGround_Mobile_Developer_PRD.md` and
   `docs/GameGround_Mobile_App_PRD.md` are references, not reading assignments: open only the
   §-sections the current task cites (grep the § number). NEVER read either PRD end-to-end.
   `docs/MOTION.md` is read by numbered section whenever a task touches animation, transitions,
   states, feedback, or celebrations — same grep-the-section rule.
4. Source files: read only files you are about to edit or that the current task names, plus
   `src/api/types.ts` / `src/hooks/queries/keys.ts` when touching data flow. Do not "explore
   the codebase to get familiar" — PROGRESS.md's file map is your familiarity.

Do-not-read list (never open unless the task is specifically about them):
`docs/CLAUDE_CODE_BRIEFS.md` in full · both PRDs in full · `package-lock.json` ·
`node_modules/**` · `assets/**` · `.expo/**` · any milestone brief other than the active one.

If context is getting long mid-session: re-read `docs/PROGRESS.md`, then continue. It is the
recovery point — that only works if you keep it updated (below).

## UPDATE DISCIPLINE — write state as you work, not at the end

- After completing ANY task or subtask: immediately update `docs/PROGRESS.md` — tick the box,
  move the `← current` marker, add a one-line note if a decision was made or a gotcha found.
- Batch-editing several files for one task = one PROGRESS update, after the task, not per file.
- New file created → add it to the File Map in PROGRESS.md with a 5-word purpose.
- Discovered work that isn't in the current milestone brief → one line in `BACKLOG.md` with a
  target milestone. Do NOT do it now. Do NOT expand scope silently.
- Architectural choice made (or deviation from a PRD §) → one line in `docs/DECISIONS.md`
  (date, decision, why). Deviations also get flagged to me in your reply.
- End of every session, even mid-task: update the Status block + "Next action" line in
  PROGRESS.md so the next session starts in one read. If asked to stop suddenly, this update
  happens BEFORE any summary you write to me.

## HARD RULES (violating any = stop and ask)
- Client never sends/computes money amounts; server numbers render as-is.
- No success UI before /payments/verify (or 409, or reconciled history) confirms.
- Tokens only via src/lib/storage.ts (SecureStore). Never in logs/analytics/Sentry.
- No raw fetch outside src/api/. No hex colors outside src/lib/tokens.ts. Screens don't fetch —
  hooks/queries only.
- Never optimistic UI for join/registration/payment state.
- Web repo behavior must stay byte-identical for the web client when working server-side.
- Stay inside the active milestone's scope. Anything else → BACKLOG.md.

## DESIGN BAR — how premium happens here
The design kit (docs/GameGround_Mobile_App.html) is the FLOOR: layout, color, typography,
spacing, and component anatomy are fixed. If a kit layout seems wrong, STOP and flag it with a
specific alternative — never silently "improve" it. Kit deviation without a logged decision is a
review-blocker. The CEILING — where you must exceed the kit — is the interaction layer, governed
entirely by docs/MOTION.md: motion, gestures, touch feedback, states (loading/empty/error/offline
designed for every screen — spinners banned), haptics, and celebrations. The approved reference
build is docs/GameGround_Design_Excellence_v3.html — when in doubt about feel, match it.
The bar is falsifiable, not vibes: ≥60fps measured on the reference Android; reduced-motion
fallback for every animation; ≥44pt targets with a11y labels; skeleton first-paint <100ms;
worklets only. Performance beats beauty. Anything product-shaped discovered while polishing is a
FEATURE → BACKLOG.md, never the current branch.

## COMMANDS
dev: npx expo start --dev-client · test: npm test · lint: npm run lint ·
typecheck: npx tsc --noEmit · release check: scripts/release-check.sh
```

---

## 2. `docs/PROGRESS.md` (create once; Claude Code maintains it)

```markdown
# PROGRESS — Game Ground Mobile

## Status
**Active milestone:** M0 — Foundation & Scaffold (branch m00-foundation)
**Current task:** M0 task 1 — scaffold project structure  ← current
**Blocked on:** nothing
**Next action:** run create-expo-app, commit folder structure per dev PRD §2.3
**Last session:** 2026-07-10 — repo initialized, docs added

## Milestone board
- [ ] M0 Foundation & Scaffold          ← ACTIVE
- [ ] M1 Server: security + mobile auth (web repo)
- [ ] M2 API client & auth flow
- [ ] M3 Design system components
- [ ] M4 App shell & navigation
- [ ] M5 Games: browse & detail
- [ ] M6 Payments engine
- [ ] M7 Games: actions
- [ ] M8 Coaches
- [ ] M9 Camps / Workshops / Events (Discover)
- [ ] M9A Home experience (server after M1 / client after M9)
- [ ] M10 Leaders & search        (parallel-safe w/ M11)
- [ ] M11 Profiles                (parallel-safe w/ M10)
- [ ] M12 Push notifications
- [ ] M13 Deep links
- [ ] M14 Delight pass
- [ ] M15 Performance & offline
- [ ] M16 QA, security audit, beta
- [ ] M17 Store submission & launch

## Active milestone tasks (mirror of the M-brief, ticked live)
<!-- Claude Code: on milestone start, copy the brief's TASKS as checkboxes here.
     On milestone close, replace with a one-line summary + move to Done log. -->
- [ ] 1. Scaffold + folder structure  ← current
- [ ] 2. Dependencies
- [ ] 3. tokens.ts
- [ ] 4. storage.ts
- [ ] 5. ESLint guard rules
- [ ] 6. app.config.ts + eas.json
- [ ] 7. Root layout + placeholder screen
- [ ] 8. CI
- [ ] 9. EAS dev build

## Exit criteria for active milestone
<!-- copied from the brief; each needs evidence before merge -->
- [ ] lint fails on planted hex color (demonstrated)
- [ ] tsc + lint + jest green locally and in CI
- [ ] dev-build install steps produced for both platforms
- [ ] placeholder screenshot: serif font + token colors

## File map (living index — 5 words per file, update on create)
docs/          → PRDs, briefs, this file
(populate as files are created)

## Gotchas & decisions (one-liners; big ones also go to docs/DECISIONS.md)
- (empty)

## Done log
- (empty — one line per closed milestone: "M0 closed 2026-07-xx — <link to merge PR>")
```

---

## 3. Session prompts

**Starting or resuming any session (the everyday one):**

```
Read docs/PROGRESS.md. Then read ONLY the active milestone's brief section in
docs/CLAUDE_CODE_BRIEFS.md and any dev-PRD § the current task cites — nothing else.
Report in 5 lines: active milestone, done, current task, blockers, your plan for this session.
Then proceed. Follow CLAUDE.md context and update discipline throughout: tick PROGRESS.md
after every task, and update its Status + Next action before you finish, even if I stop you
mid-task.
```

**Starting a NEW milestone:**

```
We are opening M<n> on branch <branch>. Read docs/PROGRESS.md, then the M<n> brief in
docs/CLAUDE_CODE_BRIEFS.md. Copy the brief's TASKS and EXIT criteria into PROGRESS.md's
active-milestone sections as checkboxes, set the Status block, then start task 1.
Read spec §-sections only as the tasks cite them.
```

**Closing a milestone:**

```
M<n> tasks are ticked. Walk the EXIT criteria in PROGRESS.md one by one and produce evidence
for each (test run, command output, or tell me exactly what screenshot/manual check I must do).
Anything failing → fix before proceeding. When all pass: update PROGRESS.md (move M<n> to the
Done log, clear active sections, set next milestone as ACTIVE with its Next action), append
any decisions to docs/DECISIONS.md, and give me the merge checklist.
```

**Context feels degraded / long session recovery:**

```
Stop. Re-read docs/PROGRESS.md and re-state in 3 lines: current task, what you last completed,
next action. Confirm against git status/diff that PROGRESS.md matches reality; fix the file if
it doesn't. Then continue only the current task.
```

---

## Why this shape (so you can tune it later)

- **PROGRESS.md is the single recovery point.** Claude Code sessions degrade when state lives
  only in the chat. Everything needed to resume — milestone, task, file map, next action — is
  one small file, so a fresh session or a compacted context reorients in one read instead of
  re-ingesting ~90KB of PRDs.
- **The briefs/PRDs are indexed, not ingested.** The § citations inside each brief act as
  pointers; the rules force grep-and-read-the-section instead of open-the-whole-file. That's
  where the real token savings are.
- **Updates are event-driven, not end-of-session.** "Update after every task" survives crashes,
  interruptions, and you closing the laptop; "update at the end" doesn't.
- **The file map replaces exploration.** The usual context burner is Claude Code "getting
  familiar" by reading half the repo. A maintained 5-words-per-file index makes that
  unnecessary — and it only stays maintained because updating it is a hard rule.

Also create empty `BACKLOG.md` (repo root) and `docs/DECISIONS.md` now so the rules always have
somewhere to write.
