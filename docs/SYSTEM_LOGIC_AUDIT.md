# System logic audit — web + mobile

**Status:** findings, not decisions. Nothing here is settled until it lands in `DECISIONS.md`.
**Date:** 6 Aug 2026
**Scope:** the `GG` Next.js app — API routes, admin surface, and shared libs — plus the mobile
client where it mirrors or depends on them. Almost every rule below lives on the **website**; the
mobile app is a consumer of it, so a hole here is a hole in both products at once.
**Method:** every finding has a file, a line, and a failure that really happens. Where I am
inferring rather than reading, it says so.

> **Read this first — the local `GG` checkout is behind production.** Two independent proofs in
> §8.2. Verify anything money- or slot-related against production before building on it.

---

## Severity index

| # | Finding | Area | Severity |
|---|---|---|---|
| 1.1 | Game price is charged per-head but entered as a total — silent 4× overcharge | Money | **Critical, live** |
| 1.2 | No payout rail exists — hosts never receive game money | Money | **Critical** |
| 1.3 | Leaving a paid game refunds nothing, and the seat is resold | Money | **Critical, live** |
| 1.4 | Cancelling a paid game refunds nothing | Money | **Critical, live** |
| 1.5 | Refund tooling is per-category; **games and coaches have none** | Money | High |
| 1.6 | Coach payments record `entityId = bookingId`, breaking entity queries | Money | Medium |
| 2.1 | The waitlist is write-only — nobody is ever promoted | Capacity | **Critical** |
| 2.2 | Camp registration ignores its deadline (both paths) and its status (paid path) | Capacity | High |
| 2.3 | Camp free-registration can oversell — read-then-increment, not a conditional claim | Capacity | High |
| 2.4 | Cancelling a paid camp registration refunds nothing | Money | High |
| 2.5 | Host-seat accounting: local code and production disagree | Capacity | Unknown — verify |
| 3.1 | All reputation is gated behind a manual admin click, per game | Ops | **Critical at scale** |
| 3.2 | Coach reviews require a manual admin "complete" before anyone can write one | Ops | High |
| 4.1 | The 90-minute cutoff is duplicated in four places | Drift | Medium |
| 5.1 | Two generations of `imageUrl` data; server still writes the old shape | Data | Medium (client fixed) |
| 6.1–6.4 | Push, deep links, Home, Sentry — server halves that do not exist | Launch | **Blocking** |
| 7.1 | ✅ Admin auth coverage is complete — closes an open `todo.md` item | Security | Clear |

---

## 1. Money

### 1.1 Game price is per-head, but the host enters a total — *live, and it overcharges*

```ts
// GG/src/lib/checkout.ts:32
export function gameChargePaise(g: { costAmount: number }): number {
  const paise = rupeesToPaise(g.costAmount);
  if (paise <= 0) throw new NotPayableError("This is a free game");
  return paise;
}
```

No division by `slots`. No reference to headcount. Whatever number the host types is charged **to
each joiner, in full**. `create-order` derives the amount from the DB and ignores the client
(`payments/create-order/route.ts:41-43`) — the server is authoritative about the wrong quantity.

**Failure:** badminton doubles, 4 players, court costs ₹500. Host types `500`.

| | Amount |
|---|---|
| Charged to each of 3 joiners | **₹500** |
| Collected by Game Ground | **₹1,500** |
| Paid to the host who fronted the court | **₹0** |
| Host's net position | **−₹500** |

The error scales with capacity — the bigger the game, the worse it gets. It is live on both the
website and the app, because both call the same route.

**Fix direction:** take **total + capacity** at create time, derive `perHead = ceil(total / slots)`,
and keep `costAmount` storing the per-head value so every existing payment path is untouched. Show
the division at create time: *"₹500 ÷ 4 = ₹125 each. You'll collect ₹375 from 3 players."*

### 1.2 There is no payout rail — at all

Grepped `src/lib`, the payment routes, and `schema.prisma`: no payout, no settlement, no Razorpay
Route, no linked accounts. Nothing points money at `organizerId`.

```
Payment { userId (the payer), entityType, entityId, amount, status, … }
```

Money flows joiner → Razorpay → **Game Ground's account**, and stays there. The schema has no
concept of owing anything to a host. Creating a game charges nothing (`games/route.ts:129` writes
no `PaymentOrder`, no `Payment`), and `verify` explicitly bars the host from being a player:

```ts
// payments/verify/route.ts:200
if (game.organizerId === session.id) return fail("You cannot join your own game", 400);
```

So the host is structurally a non-payer *and* a non-payee.

**Three ways out:**

| Option | Shape | Verdict |
|---|---|---|
| **1. Don't touch game money** | Display "₹125/head, settle with the host"; process nothing | Honest, zero infra, upgrades later with no migration |
| **2. Razorpay Route** | Per-host linked accounts + KYC | Wrong shape — hosts are individuals, not merchants; unmaintainable solo |
| **3. Collect → ledger → pay out on finalize** | Hangs off `completedAt` / `adminVerified` / `pointsAwarded`, which already exist | The only viable one if game payments ship in v1; doubles as escrow, which also fixes 1.3/1.4 |

**On the host's own share:** the host *is* one of the four. Cleanest model is that their share is
simply excluded — they front ₹500, collect ₹125 × 3 = ₹375, net ₹125, exactly one player's share.
No host-side payment, no circular money, no new payment code.

**The part with no clean answer:** price is fixed at capacity, attendance is not. If only 2 join,
the host collects ₹250 and eats ₹250. Re-splitting after capture is the one option genuinely closed
to you. So: host absorbs the shortfall (how casual games already work socially), or a
minimum-players threshold that auto-cancels and refunds — which needs Option 3 anyway.

### 1.3 Leaving a paid game refunds nothing, and the seat is resold — *live*

```ts
// GG/src/app/api/games/[id]/route.ts:143-149  (DELETE = leave)
await prisma.$transaction([
  prisma.gamePlayer.delete({ where: { id: gp.id } }),
  prisma.game.update({
    where: { id },
    data: { slotsLeft: { increment: 1 }, status: game.status === "full" ? "open" : undefined },
  }),
]);
```

The row is deleted, the seat returns to inventory, and **the payment is never touched**. The only
guard is a 90-minute cutoff — leaving three days early still forfeits the full amount.

**Failure:** A pays ₹125 and joins. A leaves a week early, gets ₹0 back. The seat returns to
inventory; B pays ₹125 for it. Game Ground has collected **₹250 for one seat** and owes a refund it
has no code to issue.

### 1.4 Cancelling a paid game refunds nothing — *live*

A host cannot cancel once anyone has joined:

```ts
// GG/src/app/api/games/[id]/cancel/route.ts
if (participantCount > 0) {
  return fail("This game cannot be cancelled because players have already joined. Please contact an administrator.", 403);
}
```

The admin path it defers to (`admin/games/[id]/route.ts:29-36`) just flips `status: "cancelled"`,
stamps `cancelledAt`, releases `slotId`, and returns. **Paid joiners stay charged.**

### 1.5 Refund tooling is per-category — and the two most-cancelled entities have none

This is more nuanced than "refunds don't exist". `src/lib/adminBookings/actions.ts:10-16` defines
exactly what an admin may do per category:

```ts
export const ALLOWED_ACTIONS: Record<CategoryKey, BookingAction[]> = {
  coaches:         ["approve", "reject", "complete", "cancel"],
  "play-sessions": ["mark-attended", "mark-no-show", "cancel"],
  workshops:       ["cancel", "mark-paid", "mark-refunded"],
  camps:           ["cancel", "mark-paid", "mark-refunded"],
  events:          ["approve", "reject", "refund", "cancel"],
};
```

| Category | Refund capability |
|---|---|
| **events** | ✅ real — `refund` updates `Payment.status = "refunded"` and the registration (`actions.ts:77-92`) |
| **camps / workshops** | ⚠️ `mark-refunded` marks the registration; bookkeeping, not a gateway refund |
| **coaches** | ❌ none |
| **games** | ❌ **not an admin booking category at all** |

So the entity most likely to be cancelled — a pickup game, cancellable by an admin at any time per
§1.4 — is the only paid entity with **no refund tooling whatsoever**, not even a status marker.
Every refund for a cancelled paid game is an out-of-band Razorpay dashboard action with no record
in the product.

### 1.6 Coach payments record the booking id where every other entity records the entity id

```ts
// payments/verify/route.ts:113-120  (coach branch)
await tx.payment.create({
  data: { userId: session.id, entityType, entityId: created.id, … }   // created = the Booking
});
```

Every other branch writes the purchased entity's id. `PaymentOrder` — written at create-order time
for the *same purchase* — documents its own field as *"the PURCHASED entity id (coachId, campId,
gameId, …)"* and stores the **coachId**.

**Failure:** `Payment` carries `@@index([entityType, entityId])` for exactly this lookup. "All
payments for coach X" returns nothing. Reconciling `PaymentOrder` against `Payment` on `entityId`
silently fails for every coach booking.

---

## 2. Capacity and lifecycle

### 2.1 The waitlist is write-only — nobody is ever promoted

Entries are created when a join loses the capacity race:

```ts
// games/[id]/route.ts:97-102
if (claim.count === 0) {
  …
  await prisma.waitlistEntry.create({ data: { gameId: id, userId: session.id, position } });
  return ok({ waitlisted: true, position });
}
```

I grepped every `waitlist` reference in `src/`. Outside this block the only writes are
`admin/games/[id]/route.ts:120` (`deleteMany` when an admin deletes the game) and read-only counts
for the admin dashboard. **There is no promotion logic anywhere.** The leave path (§1.3) increments
`slotsLeft` and flips `full → open` without ever consulting the waitlist.

**Failure:** the game fills; C waitlists at position 1. A leaves. The seat returns to open inventory
and goes to whoever refreshes first. C is never promoted, never notified, and sits on a list nothing
reads. The web UI offers the CTA too (`app/game/[id]/page.tsx:618`, `play/PlayClient.tsx:329`), so
this is a broken promise on **both** products.

**It makes a shipped PRD acceptance criterion unimplementable:** 6.2 AC 3 — *"Full game shows
waitlist CTA; promotion off waitlist triggers a push"* — and the M12 push category *"Waitlist
promotion → 'A slot opened up — you're in!'"*. The push is not the missing piece. The promotion is.

### 2.2 Camp registration ignores its deadline (both paths) and its status (paid path)

Compare the four entity branches of `payments/verify/route.ts`:

| Entity | Capacity | Deadline | Status |
|---|---|---|---|
| Workshop (`:240-242`) | ✅ | ✅ | ✅ |
| Event (`:167-168`) | ✅ | ✅ | — |
| Game (`:201-202`) | ✅ | n/a | ✅ |
| **Camp (`:131-133`)** | ✅ | ❌ | ❌ |

The free path is inconsistent with the paid one — it checks status but still not the deadline:

```ts
// camps/[id]/route.ts:45
if (["closed", "completed", "archived"].includes(camp.status)) return fail("Registrations are closed for this camp", 409);
```

`Camp` has **both** fields (`registrationDeadline DateTime`, `status String` in `schema.prisma`).

**Failure:** a user can pay to register for a camp whose registration deadline passed, or one the
`complete-games` cron has already marked `completed`. Money captured, registration created.

### 2.3 Camp free-registration can oversell

```ts
// camps/[id]/route.ts:46,51-59
if (camp.participants >= camp.maxParticipants) return fail("Camp is full", 400);   // read
…
const newCount = camp.participants + 1;
await prisma.$transaction([
  prisma.campRegistration.create({ … }),
  prisma.camp.update({ where: { id }, data: { participants: { increment: 1 }, status: statusUpdate } }),
]);
```

Read-then-increment, with no condition on the write. Every comparable path in the codebase uses a
**conditional claim** instead — `verify`'s camp branch (`:141-145`), the game free-join
(`games/[id]/route.ts:92-95`), coach seats (`verify:98`), workshop and event. This one is the
exception.

**Failure:** two users register concurrently for the last seat of a free camp. Both read
`participants = 9` of 10, both pass the check, both increment → **11 registrations in a 10-seat
camp**, and `statusUpdate` computed off the stale read may not fire either.

### 2.4 Cancelling a paid camp registration refunds nothing

`camps/[id]/route.ts:68-95` (DELETE) deletes the registration and decrements `participants`. It
never inspects `paymentStatus`, so a **paid** registration cancels exactly like a free one — seat
released, money kept, no refund, no marker. Same class as §1.3, different entity.

### 2.5 Host-seat accounting: local code and production disagree

Local `create` sets `slotsLeft = input.slots` with **no organizer `GamePlayer` row**
(`games/route.ts:136`). Under that code, 4 slots − 3 joins = `slotsLeft: 1, status: "open"`.

Production returns:

```
slots: 4, players: 3, slotsLeft: 0, status: "full"
```

which only works if **production makes the host consume a seat**. See §8.2 — I believe production is
simply ahead. **Verify before building on either.**

---

## 3. Operations

### 3.1 The entire reputation economy is gated behind a manual admin click, per game

By design and heavily commented — rewards are granted *exactly once*, only at admin finalize, so
cancelled games can never earn credit:

```ts
// games/[id]/complete/route.ts:8-11
// Host-triggered completion. This ONLY marks the game completed and records the
// host's attendance flags. It does NOT award any rewards — rewards (gamesPlayed,
// gamesOrganized, reliability, reputation) are granted exactly once, and only
// when an admin finalizes the game (POST /api/admin/games/[id] { action: "finalize" }).
```

The correctness argument is sound. The **operational** consequence is addressed nowhere:

- `gamesPlayed`, `gamesOrganized`, `attendanceRate` and every input to `computeReputation`
  (`reputation.ts:34-51`) only move when a human clicks finalize.
- Tiers, the leaderboard, and the tier-up celebration — which the product PRD calls *"the retention
  hook — don't cut it"* (6.6 AC 1) — are all downstream of that click.
- At the day-90 target of **1,500 installs**, that is a human finalizing every pickup game in
  Kozhikode, forever, or the whole progression system silently stops.

**Fix direction:** a policy, not just code — auto-finalize after a dispute window (say 48h post
`completedAt`) with admin override for contested games, so the manual path is the exception.

### 3.2 Coach reviews are gated on the same kind of manual click

```ts
// coaches/[id]/reviews/route.ts:23-27
const hasBooking = await prisma.booking.findFirst({
  where: { coachId, userId: session.id, status: "completed" },
});
if (!hasBooking) return fail("You can only review a coach after a completed session", 403);
```

`verify` creates bookings as `status: "approved"` (`verify:109`). Nothing time-based ever advances
them — `cron/complete-games` covers games, events, camps and workshops, **not bookings**. The only
route to `"completed"` is an admin firing `action: "complete"` on
`PATCH /api/admin/bookings/coaches` (`adminBookings/actions.ts:109`).

**Failure:** a player books, attends, and wants to review. Until an admin manually completes that
booking, the review is a 403. `reviewsGiven` also feeds `computeReputation` (×5, capped at 50 pts),
so the same manual click gates a reputation input; and `users/[id]/route.ts:59` reports
`booking.count({ status: "completed" })` on the profile, which stays 0 until someone clicks.

*(I initially read this as unreachable. It is reachable — but only by hand, and nothing in the
product tells an admin a review is waiting on them.)*

---

## 4. Rule duplication

### 4.1 The 90-minute cutoff exists in four places

```
GG/src/app/api/games/[id]/route.ts:9    const CANCEL_CUTOFF_MS = 90 * 60_000;
GG/src/app/api/camps/[id]/route.ts:9    const CANCEL_CUTOFF_MS = 90 * 60_000;
GG/src/app/api/events/[id]/route.ts:13  const CANCEL_CUTOFF_MS = 90 * 60_000;
app/src/api/games.ts                    export const LEAVE_CUTOFF_MS = 90 * 60_000;   // mobile mirror
```

Three local constants server-side plus a deliberate client mirror. The mobile copy is documented and
justified (explain the block up front rather than fire a request guaranteed to 403) — but a policy
change now has to land in four files, and nothing fails if it lands in three. Compare `gameTime.ts`
and `venues.ts`, which exist precisely to be the shared source for rules like this.

---

## 5. Data integrity

### 5.1 Two generations of `imageUrl`, and the server still writes the old shape

Production `/api/games` returns **root-relative** paths:

```json
"imageUrl": "/sports/football-01.webp"
```

The browser resolves these against the page origin. React Native cannot — `expo-image` given
`{ uri: "/sports/football-01.webp" }` fails silently and renders the placeholder. Coaches and
workshops send absolute Cloudinary URLs, which is why *some* images loaded and some did not.

**Client side: fixed** (`src/lib/imageUrl.ts` + the four API mappers, 6 Aug 2026).

**Still open server-side:** local `create` writes *absolute Unsplash* URLs (`games/route.ts:10-18`,
`SPORT_IMAGES`) while production rows carry relative `/sports/*.webp`. Two generations of data in
one column, and the write path does not match what production holds. Normalise the column, or add
the server-side equivalent of `resolveImageUrl`.

**Related, product-level:** game images are stock-per-sport either way — two football games look
identical. Worth deciding whether a game image should ever be per-game (venue photo? host upload?)
or whether the sport backdrop is deliberate.

---

## 6. Launch blockers that live in the web repo

All four are in `docs/BACKLOG.md`; listed here because they are the actual distance between this
build and a store submission, and none of them are mobile work.

- **6.1 Push has no server half.** No `DeviceToken` model, no `POST /api/push/register`, no
  `src/lib/push.ts`, no dispatcher call sites. The client is complete and degrades gracefully —
  registration fails silently and retries each app open. All six M12 categories are undeliverable.
  (Interacts with §2.1: even with the server half, waitlist-promotion push has nothing to fire on.)
- **6.2 Deep links do not verify.** `.well-known/apple-app-site-association` and `assetlinks.json`
  are not served from `gameground.net`. Needs the Apple Team ID and the release SHA-256 from
  `eas credentials`. Notification-tap routing works; externally-tapped web links do not.
- **6.3 `GET /api/home` does not exist.** Home is client-composed from `/games` + `/coaches`. The
  p95 < 300ms single-request AC (6.10 AC 1) cannot be met or measured.
- **6.4 Sentry is disabled.** Removed after `@sentry/react-native` 7.11's native auto-init threw
  `NSInvalidArgumentException` at launch; `src/lib/sentry.ts` is stubbed. The crash-free ≥ 99.5%
  gate has no source of truth until it is re-added on a compatible version.

---

## 7. What came back clean

### 7.1 Admin auth coverage is complete

`GG/todo.md` §3 lists *"Admin routes audit — every route under `/api/admin/*` should call
`getAdminSessionFromRequest`"* as an open item. I checked all 26 admin route files, comparing
exported HTTP methods against auth call sites:

**Every method in every admin route is guarded.** The only file with zero checks is
`admin/auth/route.ts` — the login route itself, which is correct.

That `todo.md` item can be closed.

### 7.2 Other things that held up under reading

- Razorpay signature verification is HMAC-checked server-side, fails closed in production when the
  secret is absent (`verify:46-49`), and the webhook uses `timingSafeEqual` on the raw body
  (`webhook:19-26`).
- `assertOrderBinding` genuinely closes cross-entity replay — a signed order for a cheap game
  cannot be redeemed against an expensive coach.
- The `PaymentOrder.capturedAt` marker makes a capture that never reaches `/verify` recoverable
  rather than silently lost, and the comment explains exactly why it is not written as a `Payment`
  row (`webhook:56-66`). That is the debit-then-network-drop path from PRD 6.7 AC 3, and it is real.
- Slot double-booking is guarded by `Game.slotId @unique` with the P2002 race mapped to a friendly
  409 (`games/route.ts:147-152`).

---

## 8. Meta

### 8.1 What I did not audit

Auth/refresh-token rotation, venue/slot generation, the events and workshops admin surfaces beyond
their action maps, the registerable date-window logic (recently reworked — see the last three `GG`
commits), the AI-recommend route, rate-limit coverage, and the mobile client's own state machines.
Absence from this document is not a clean bill of health.

### 8.2 Proof that local `GG` is behind production

1. **Images.** Local `create` writes absolute Unsplash URLs (`games/route.ts:10-18`); production
   rows carry `/sports/badminton-05.webp`, and `GG/public/sports/` does not exist locally.
2. **Slot arithmetic.** §2.5 — local would produce `slotsLeft: 1, status: "open"` where production
   returns `slotsLeft: 0, status: "full"`.

Local `HEAD` is `fb9e37e` (2 Aug 2026). Pull before acting on anything in §1–§3.

---

## 9. What I would decide first

1. **Does Game Ground touch game money at all?** (§1.2, Option 1 vs 3.) Every other money question
   is downstream, including whether §1.3, §1.4, §1.5 and §2.4 are bugs or non-features.
2. **Fix §1.1 regardless.** A silent 4× overcharge is a bug today, not a design question, and it is
   live on every paid game on both products right now.
3. **Waitlist: build it or remove it.** (§2.1.) A CTA that adds users to a list nothing reads is
   worse than no waitlist — it makes a promise the system cannot keep, on web and mobile both.
4. **Auto-finalize policy.** (§3.1, §3.2.) Reputation and reviews — the retention hook and the
   social proof — cannot both depend on a human clicking once per game and once per booking.
5. **Camp parity pass.** (§2.2, §2.3, §2.4.) Camps are the one entity that consistently diverges
   from the patterns every other entity follows. Three separate holes, one root cause.
