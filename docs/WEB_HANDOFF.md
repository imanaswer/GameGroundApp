# Web repo — handoff for launch

**To:** whoever owns `github.com/imanaswer/GG` and the Vercel team `gameground-dev`
**From:** an audit of `GG(web)` run 7 Aug 2026, alongside a full production-readiness audit of the mobile app
**Why you're getting this:** the mobile app is a pure client of this API — it computes no prices, holds no gateway credential, and trusts the server for money, slots and eligibility. Several things it needs are here, and one live bug here overcharges players today.

Everything below was verified by reading the current source, not inferred from the audit docs. Each item cites the file so you can check it in a minute.

---

## 1. Fix this first — players are being overcharged 4×, right now

`src/lib/checkout.ts:32`

```ts
export function gameChargePaise(g: { costAmount: number }): number {
  const paise = rupeesToPaise(g.costAmount);
  if (paise <= 0) throw new NotPayableError("This is a free game");
  return paise;
}
```

There is no division by `slots` and no reference to headcount. The host enters what they believe is the **total** court cost; every joiner is charged that full amount.

**Badminton doubles, 4 players, ₹500 court. Host types `500`. You collect ₹2,000.**

`create-order` derives the amount from the DB and ignores the client, so the server is authoritative — about the wrong quantity. This is listed as *Critical, live* in your own `SYSTEM_LOGIC_AUDIT.md §1.1` and is still exactly as described.

Nothing else on this list matters as much. It takes real money from real users on every paid game.

---

## 2. Verified still open

I checked eight documented findings against the source. **All eight are open.** I did not check the remaining eleven.

### 2.1 `create-order` mints live Razorpay orders before checking eligibility
`src/app/api/payments/create-order/route.ts:12-48`

`chargePaiseFor` asks one question — is the price above zero? (plus `seatsLeft` for coaches). `verify` then applies a much longer list. Every gap between them is a user who **pays and is then refused**.

The fix your audit prescribed was five predicates in `checkout.ts` — `assertGameJoinable`, `assertCampOpen`, `assertEventOpen`, `assertWorkshopOpen`, `assertCoachBookable`. I grepped all of `src`: **none of them exist**. `checkout.ts` still contains only the charge functions and `assertOrderBinding`.

Clearest case: a host taps pay on their own paid game. `create-order` succeeds, Razorpay captures, `verify` returns `"You cannot join your own game"` (`verify/route.ts:200`). Money taken, no seat. Also a genuine race — two people paying for the last slot seconds apart, and the loser is charged.

### 2.2 Paid game join has none of the free join's time rules
`src/app/api/payments/verify/route.ts:197-202` vs `src/app/api/games/[id]/route.ts:77`

The free join path calls `joinability(game, new Date(), session.id)`. The paid path checks `organizerId`, `status`, `slotsLeft` — and **never looks at the clock**. No `joinability`, no `scheduledAt`. So you can pay to join a game that has already started or finished, provided its `status` hasn't been flipped yet.

Which compounds with the next one.

### 2.3 The lifecycle cron runs once a day
`vercel.json` → `/api/cron/complete-games` on `0 0 * * *`

Every time-based status is **up to 24 hours stale**. Combined with 2.2, a game that ended this morning still reads `open` and is still payable until midnight.

### 2.4 Camp registration deadline is never enforced
`src/app/api/payments/verify/route.ts:127-133`

The camp branch selects `participants, maxParticipants, price` — no `registrationDeadline`, no `status`. Events and workshops *do* check their deadlines (lines 168 and 242). Camps don't, on either the paid or the free path.

### 2.5 Nothing refunds, anywhere
The only occurrence of "refund" in the entire API is a comment in `payments/webhook/route.ts:75`:

> `// refund events are handled by admin "Mark refunded" action, not the webhook`

So leaving a paid game, cancelling a paid game, and cancelling a paid camp registration all refund nothing — and in the leave case the seat is resold. `SYSTEM_LOGIC_AUDIT` rates 1.3 and 1.4 *Critical, live*. Whatever you decide the policy is, it needs to be **stated on the payment screen** before launch, because "no refunds, ever, by omission" is not a policy anyone chose.

### 2.6 The waitlist is write-only
`src/app/api/games/[id]/route.ts:98-102` creates `waitlistEntry` rows with a position. I found no code anywhere that promotes from it, removes from it, or notifies. People join a queue that never moves. (This also means the mobile app's waitlist-promotion notification has nothing to fire on — see §3.)

### 2.7 Upload advertises 5 MB over a 4.5 MB platform cap
`src/app/api/upload/route.ts:9` → `MAX_BYTES = 5 * 1024 * 1024`, and `src/lib/cloudinaryUpload.ts:13` → `MAX_SIZE = 5 MB`. The comment three lines above the second one names the problem: *"Vercel's 4.5 MB function-payload cap"*. Files between 4.5 and 5 MB are accepted by your validation and then killed by the platform, with no useful error.

### 2.8 `pending_approval` coaches
`src/app/api/coaches/[id]/route.ts` does not filter on approval status in its `where`. Worth confirming against the list route and the booking path — I read the detail route only.

---

## 3. What the mobile app is waiting on from you

The client halves of all of these are **built, shipped and degrade gracefully**. They do nothing until the server side exists.

| | What's needed | Consequence today |
|---|---|---|
| **Push** | `POST`/`DELETE /api/push/register`, `PATCH /api/push/prefs`, a `DeviceToken` model, and a dispatcher called from: reminders cron, waitlist promotion, event announcement, payment webhook, tier change, game cancel | `src/app/api/` has no `push/` directory. **All six notification categories are undeliverable**, and there is no "notify affected users" lever during an incident |
| **Home** | `GET /api/home` — authed, per-user sections, p95 < 300 ms | No `home/` directory. The app composes Home from `/games` + `/coaches`; the single-request performance criterion can't be measured |
| **Deep links** | Serve `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` — `application/json`, **no redirect**, on **both** `www.gameground.net` and the apex `gameground.net` | Universal/App Links never verify; web links open the browser instead of the app |

**Two specifics on the deep-link files, both of which will silently fail if you get them wrong:**

- The bundle id is **`net.gameground.redesigned`**, not `net.gameground.app`. An older handoff doc had the wrong one. Publishing the wrong id produces no error anywhere — iOS just never associates the domain.
- The apex must serve the files **directly**. A 301 from `gameground.net` → `www` does not satisfy the spec.

You'll need the Apple Team ID and the Android release SHA-256 from `eas credentials` — those don't exist yet on the mobile side, so this one is blocked on us, not you. We'll send them.

---

## 4. Operational — the part that isn't code

### 4.1 The mobile kill switch lives in your Vercel, and only you can pull it

`RUNBOOK.md §2` (mobile repo) documents the emergency stop for the app: set `MIN_MOBILE_VERSION` and **redeploy**. The client half is wired and working — any HTTP 426 routes the app to a no-dismiss upgrade wall, and every request sends `X-App-Version`.

But the lever is a Vercel env var on **your** team. Sarang can't reach it. That means the person on call for the mobile app **cannot stop a bad release** — the one mechanism that works even when the bug is in the shipped bundle, reserved for data-corruption and money bugs. Same for "roll back the Vercel deploy", which the runbook names as the fastest lever of all.

Before launch this needs either shared access or a written escalation path with **your response time**, because that time *is* the incident SLA.

Worth rehearsing once on preview: set `MIN_MOBILE_VERSION` above the installed build, redeploy, confirm the wall appears, clear it.

### 4.2 Credential rotation needs both of you, at the same time

These secrets were exposed and need rotating: Supabase DB password, Google client secret, Razorpay key secret, Resend API key, Cloudinary API secret, admin password.

Each rotation is **rotate at provider → update Vercel → redeploy**. Steps 2 and 3 are yours. If they lag, the site is running against a dead credential — and for the Supabase password that means **every API route 500s**, taking the mobile app down with it, since it has no other backend.

So: schedule it, do it together, one secret at a time, verify the site between each. Note `DATABASE_URL` **and** `DIRECT_URL` both carry the Supabase password — miss one and Prisma migrations break later, quietly.

**Do the Razorpay test key secret first.** It was briefly committed to a public repo and should be treated as disclosed, even though the commit has since been rewritten.

---

## 5. What I did not check

Being explicit so this isn't mistaken for a clean bill of health:

- Eleven of the nineteen documented findings — including the coach-reliability score reading the wrong id, host-seat accounting, free camp registrations never counting for reputation, workshops never completing, and `/api/search` returning cancelled/archived rows.
- I never ran the build, the test suite, or `prisma migrate` — no `npm install` against this repo.
- Nothing was checked against the **production database**. Your own `SYSTEM_LOGIC_AUDIT.md §8.2` warns that the local checkout is behind production, so verify anything money- or slot-related against prod before acting.
- No load, security scanning, or dependency-vulnerability work.

---

## 6. Suggested order

1. **Game pricing (§1).** Live money, every paid game. Nothing else competes.
2. **Refund policy (§2.5)** — decide it, then either implement it or state it plainly at checkout.
3. **`create-order` eligibility (§2.1)** and **paid-join time rules (§2.2)** — these are the "charged then refused" paths.
4. **Cron cadence (§2.3)** — cheap change, makes 2.2 far less reachable.
5. **Kill-switch access (§4.1)** — must be settled before the app is on a store.
6. **Credential rotation (§4.2)** — scheduled, together.
7. **Push + `/api/home` (§3)** — feature work; the app ships without them, just diminished.
8. Then the remaining findings in your own `SERVER_AUDIT_2_WEB_FIXES.md`.
