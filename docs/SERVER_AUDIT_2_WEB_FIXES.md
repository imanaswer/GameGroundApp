# Second sweep — Web Repo Fix Plan

**Repo:** `gameground.net` (Next.js + Prisma). Companion to `ACCOUNT_DELETION_WEB_FIXES.md`; nothing
here overlaps with the three bugs written up there. **No mobile app change is required for any of
these.**

The question was "are there more bugs of the same kind". There are. The three in the first document
were all instances of one shape: **two paths write the same invariant, and only one of them knows
the rule.** Searching for that shape across the rest of the API turns up thirteen more.

| | What | Severity |
|---|---|---|
| **1** | `create-order` mints a real Razorpay order before any eligibility check `verify` will apply | high |
| **2** | `pending_approval` coaches are publicly listed and bookable — the approval gate is bypassed | high |
| **3** | Deletion cancels coach bookings without releasing the seat, and illegally leaves terminal states | high |
| **4** | Paid game join has none of the free join's time rules — you can pay into a game that has ended | high |
| **5** | The lifecycle cron runs once a day, so every time-based status is up to 24 h stale | high |
| **6** | Camp registration deadline is never enforced, anywhere | medium |
| **7** | The waitlist is write-only: nothing ever promotes from it, nothing ever leaves it | medium |
| **8** | Booking a full batch claims no seat — then cancelling **increments** `seatsLeft` past `totalSeats` | medium |
| **9** | The reliability score's review term reads `Review.coachId` with a player's `User.id` | medium |
| **10** | Workshops never complete and never archive | medium |
| **11** | Free camp registrations stay `paymentStatus: "pending"`, so they never count for reputation | medium |
| **12** | `/api/search` returns cancelled and archived events, and archived camps | low |
| **13** | Upload advertises a 5 MB ceiling the platform caps at 4.5 MB | low |

Suggested sequencing is at the bottom. 1, 3 and 4 are the ones that cost money or corrupt data.

---

## 1 — `create-order` mints a real order before checking whether the purchase can succeed

`src/app/api/payments/create-order/route.ts:13-47`. `chargePaiseFor` looks up the entity and asks one
question: *is the price above zero?* (`coach` additionally checks `seatsLeft`.) Then the route calls
Razorpay, persists the `PaymentOrder`, and hands the client a live order.

`verify` then applies a completely different, much longer list of preconditions:

| | `create-order` checks | `verify` checks |
|---|---|---|
| game | price > 0 | price, organizer ≠ buyer, status not closed, `slotsLeft > 0`, status ≠ full |
| camp | price > 0 | price, `participants < maxParticipants` |
| event | fee > 0 | fee, capacity, **registrationDeadline** |
| workshop | price > 0 | price, capacity, deadline, status |
| coach | price, `seatsLeft` | price, `seatsLeft` |

Every row where the right column is longer than the left is a case where the user **completes payment
and is then refused**. The clearest one: a host taps pay on their own paid game. `create-order`
succeeds, Razorpay captures, `verify` returns `"You cannot join your own game"` (`verify:200`) — money
taken, no seat, and the only trace is the `capturedAt`-without-`Payment` orphan the `PaymentOrder`
comment (`schema.prisma:498-504`) describes as something to "refund or complete manually".

The UI hides the button in most of these cases, which is why it has not been noticed. It is not a
defence — the endpoint is authenticated and directly callable, and the race is real without any
malice: two people can pay for the last slot seconds apart and the loser is charged.

**Fix.** `create-order` must apply the same admission checks as `verify`. The clean version is to
lift them out of both routes into pure predicates next to `campChargePaise` and friends in
`src/lib/checkout.ts` — that file already exists precisely so "create-order and verify cannot drift",
and the price is the only thing it currently covers:

```ts
// src/lib/checkout.ts
export function assertGameJoinable(g, userId, now) { /* joinability() + slotsLeft + status */ }
export function assertCampOpen(c, now) { /* status, capacity, registrationDeadline (see Bug 6) */ }
export function assertEventOpen(e, now) { /* status, capacity, deadline (see below) */ }
export function assertWorkshopOpen(w, now) { /* status, capacity, deadline */ }
export function assertCoachBookable(c) { /* seatsLeft AND status === "active" (see Bug 2) */ }
```

Call them from both routes. `verify` keeps its atomic conditional claims — those guard the race;
these guard the charge.

Two gaps the same fix closes, worth naming because they are live on their own:

- **`verify`'s camp branch (`:131-133`) checks neither `status` nor `registrationDeadline`.** Compare
  the workshop branch four blocks down (`:240-242`), which checks both. So a paid camp that is
  `completed` or `archived` is still purchasable.
- **`verify`'s event branch (`:166-168`) checks the deadline but not `status`.** A **Cancelled** event
  whose deadline has not yet passed still takes money.

---

## 2 — Unapproved coaches are publicly listed and bookable

`src/app/api/coaches/register/route.ts:63` — self-service registration creates the `Coach` row with
`status: "pending_approval"`, and mails a partnership-agreement signing link. An admin later flips it
to `active` or `inactive` (`coaches/[id]/approve/route.ts:14`).

`src/app/api/coaches/route.ts:15-34` — the public listing builds its `where` from `sport`, `type`,
`skillLevel`, `available` and the text query. **`status` is never in it.** `prisma.coach.findMany({ where })`
returns pending and inactive coaches alongside active ones.

So the moment anyone posts to `/api/coaches/register` they are live on `/learn`, with the name,
phone, email and address they typed, before any human has looked at them and before the agreement is
signed. And they are bookable:

- `POST /api/bookings:56-58` selects `{ id, seatsLeft }` — no status check.
- `payments/verify:76-80` (coach branch) selects `{ id, priceMin, priceMax, seatsLeft }` — no status check.
- `payments/create-order:24-27` — no status check.
- `ai/recommend:22` — `where: { seatsLeft: { gt: 0 } }`, no status check.

`/api/search:17` is the only reader that gets it right (`status: "active"`), which is what makes this
look like an omission rather than a decision.

**Fix.** Add `status: "active"` to the listing (`coaches/route.ts`) and to `ai/recommend`, and reject
non-active coaches in `bookings` POST, `create-order` and `verify` — the `assertCoachBookable`
predicate from Bug 1. Consider also gating on a signed agreement: `requireSignedAgreement` already
exists (`src/lib/coachAgreement/gate.ts`) and is enforced on profile edit (`users/[id]:153`) but not
on being listed or booked.

Also worth a decision, not proposed here: `GET /api/coaches/[id]` returns the whole `Coach` row,
including `phone`, `email` and `address`, to logged-out visitors. `games/[id]:43` deliberately gates
the organiser's phone behind a session. For a business listing the exposure may well be intended —
but the two endpoints should not disagree by accident.

---

## 3 — Deletion cancels coach bookings without releasing the seat (extends Bug 3 of the first document)

`src/app/api/users/[id]/route.ts:203`:

```ts
prisma.booking.updateMany({ where: { userId: id }, data: { status: "cancelled" } }),
```

`src/lib/bookings.ts:22-65` (`transitionBooking`) is the *only* correct way to move a booking. It does
three things this line does not:

1. **Releases the seat.** `releasesSeat("cancelled")` is true, so it increments `coach.seatsLeft` and,
   for a batch booking, `batch.seats` (`bookings.ts:51-56`). The bare `updateMany` does neither, so
   **every deleted student costs their coach a seat permanently** — the exact failure mode as the
   game `slotsLeft` leak in the first document, one entity over.
2. **Enforces the state machine.** `ALLOWED_TRANSITIONS` (`bookingStatus.ts:12-18`) says `completed`,
   `rejected` and `cancelled` are terminal. `updateMany` rewrites a *completed* booking to
   `cancelled`, destroying the record that the session happened. `completedAt` stays set while
   `status` says cancelled — the row now contradicts itself.
3. **Stamps `cancelledAt`.** `updateMany` leaves it null, so these rows are invisible to any audit
   that reads the timestamp rather than the status.

There is a revenue consequence too: `BILLABLE_STATUSES` is `["approved", "completed"]`
(`bookingStatus.ts:10`), and `/api/bookings?role=coach:28` counts against it. Deleting a student
retroactively reduces their coach's reported completed sessions.

**Fix.** Inside the delete transaction, replace the blanket `updateMany` with a targeted release of
only the non-terminal bookings, doing the seat give-back the state machine would have done:

```ts
const live = await tx.booking.findMany({
  where: { userId: id, status: { in: ["pending", "approved"] } },
  select: { id: true, coachId: true, batchId: true },
});

for (const b of live) {
  await tx.coach.update({ where: { id: b.coachId }, data: { seatsLeft: { increment: 1 } } });
  if (b.batchId) await tx.batch.update({ where: { id: b.batchId }, data: { seats: { increment: 1 } } });
}
await tx.booking.updateMany({
  where: { id: { in: live.map(b => b.id) } },
  data: { status: "cancelled", cancelledAt: new Date() },
});
// completed / rejected / already-cancelled bookings are left exactly as they are.
```

(This cannot call `transitionBooking` directly — that opens its own `prisma.$transaction`. Either
inline it as above, or split `transitionBooking` into a `tx`-taking core and a thin wrapper, which is
the better shape if more callers appear.)

### Backfill

Seats already lost to deletions cannot be attributed row-by-row after the fact — the bookings were
overwritten in place. Rebuild from ground truth instead, which is safe to re-run:

```sql
-- seatsLeft = totalSeats - bookings currently holding a seat (pending + approved).
UPDATE "Coach" c
SET "seatsLeft" = GREATEST(c."totalSeats" - h.n, 0)
FROM (SELECT c2."id",
             (SELECT COUNT(*) FROM "Booking" b
               WHERE b."coachId" = c2."id" AND b."status" IN ('pending','approved')) AS n
      FROM "Coach" c2) h
WHERE c."id" = h."id";
```

Run it after deploying the fix. Note it also repairs the drift from Bug 8 below — do that one first if
you want a single pass. It will *not* repair `Batch.seats`, which has no comparable ground truth
(a batch's original seat count is not stored anywhere else); those need a manual look if any coach
reports a wrong batch count.

---

## 4 — Paying to join a game skips every time rule the free join enforces

`src/lib/gameTime.ts:63-71` — `joinability()` is documented as the shared rule and is called by the
free join path (`games/[id]/route.ts:77`). It rejects, in order: the host, a closed status, a game
that has **ended**, and a game that has **started**.

`payments/verify:197-202` — the paid path checks the organiser, the status, and `slotsLeft`. It never
looks at `scheduledAt` or `duration`.

A game only leaves `open` when something flips it, and the only thing that does is the cron — which
runs once a day (Bug 5). So for up to 24 hours after a paid game has finished, the free endpoint says
`"This game has already ended."` and the paid endpoint takes the money and adds a `GamePlayer` row to
a game that is over.

**Fix.** One line, in `verify`'s game branch — the game already selects everything needed once
`scheduledAt` and `duration` are added to the `select`:

```diff
-      const game = await prisma.game.findUnique({ where: { id: entityId }, select: { organizerId: true, slotsLeft: true, status: true, costAmount: true } });
+      const game = await prisma.game.findUnique({ where: { id: entityId }, select: { organizerId: true, slotsLeft: true, status: true, costAmount: true, scheduledAt: true, duration: true } });
       if (!game) return fail("Game not found", 404);
-      if (game.organizerId === session.id) return fail("You cannot join your own game", 400);
-      if (["cancelled", "completed", "archived"].includes(game.status)) return fail("This game is no longer open to join", 400);
+      const reason = joinability(game, new Date(), session.id);
+      if (reason) return fail(reason, 400);
       if (game.slotsLeft <= 0 || game.status === "full") return fail("Game is full", 400);
```

`joinability` already produces the organiser and closed-status messages, so the two deleted lines are
subsumed rather than lost. Apply the same call in `create-order` (Bug 1) so the charge never happens.

---

## 5 — The lifecycle cron runs daily, so every derived status is up to 24 hours stale

`vercel.json:6-9` — `/api/cron/complete-games` is scheduled `0 0 * * *`: once a day, midnight UTC
(05:30 IST). That single job is what marks games completed, archives them, and completes/archives
events and camps.

The code inside it is written for a much tighter cadence. `cron/complete-games/route.ts:20-24`
computes `oneHourAgo` to implement the documented rule that *"completed games stay visible for only 1
hour"* — and `games/route.ts:27-29` filters `Recent Games` on exactly that window. With a daily run
the rule cannot hold: a game finishing at 19:00 IST is still `open` and on the public browse list all
evening and all night; at 05:30 it becomes `completed`; it stays completed and visible for the whole
of the next day, because archiving needs `completedAt < oneHourAgo` and `completedAt` was set to
`now` in that same run. So the "1 hour" window is, in practice, 24 hours, and the up-to-24-hour
`open` window is what makes Bug 4 exploitable at all.

**Fix.** Change the schedule to hourly and the code starts behaving as written:

```diff
     {
       "path": "/api/cron/complete-games",
-      "schedule": "0 0 * * *"
+      "schedule": "0 * * * *"
     },
```

The job is idempotent (every branch is a filtered `updateMany`) and cheap, so frequency costs
nothing but invocations. If the visibility window genuinely wants to be one hour, `*/15 * * * *`
tracks it more honestly still. Note Vercel's Hobby plan caps cron frequency at daily — if that is
what forced this schedule, say so and the alternative is to derive game status at read time the way
`deriveEventStatus` (`src/lib/events.ts:31-38`) already does for events, rather than storing it.

---

## 6 — A camp's registration deadline is never enforced

`Camp.registrationDeadline` exists (`schema.prisma:298`) and is authored by admins. Nothing reads it.

- `camps/[id]/route.ts:41-47` (free register): checks price, `status`, capacity. No deadline.
- `payments/verify:131-133` (paid register): checks capacity. No deadline, no status.

Both sibling entities do enforce it — `workshops/[id]:59` and `events/[id]:69` — which is what makes
this an omission rather than a policy. Until the cron flips the camp to `completed` (Bug 5: up to a
day after `endDate`), registrations keep being accepted past the deadline the page displays.

**Fix.** Add `if (camp.registrationDeadline < new Date()) return fail("Registration deadline has passed", 400);`
to both paths — or, preferably, the `assertCampOpen` predicate from Bug 1 so there is one copy.

---

## 7 — The waitlist is write-only

`games/[id]/route.ts:97-103` — when the atomic slot claim finds nothing left, the user gets a
`WaitlistEntry` and a toast (`useData.ts:158`: *"Added to waitlist at position N"*). That is the
entire feature.

Grepping the repo for `waitlistEntry` finds five writes and no promotion. Specifically:

- **Leaving does not promote.** `games/[id]/route.ts:143-149` increments `slotsLeft` and reopens the
  game. The freed seat goes to whoever refreshes first; the person who queued for it is not told and
  has no advantage.
- **There is no way off the list.** No endpoint deletes a `WaitlistEntry` for a user. Only the admin
  hard-delete of the whole game does (`admin/games/[id]:120`).
- **There is no way to see your place.** The position is returned once, in the toast, and never
  again — `GET /api/games/[id]` does not include the waitlist.
- Positions drift as entries are orphaned, which the first document already noted under 3d.

So a user who "joined the waitlist" is in a queue that never moves and that they cannot leave. Whether
that is a bug or an unfinished feature is a product call — but it currently *presents* as a working
queue, which is the part that misleads.

**Fix** (the minimum that makes the promise true): in the LEAVE transaction and in the
account-deletion seat give-back, after incrementing `slotsLeft`, pop the lowest-`position` entry for
that game, create the `GamePlayer`, decrement `slotsLeft` back, and delete the entry. Add a
`DELETE /api/games/[id]/waitlist` so people can get out, and include the caller's
`waitlistPosition` in `GET /api/games/[id]` so the app can show it. Free games only — promoting into
a paid game would need a charge, which is a different design.

Note the mobile app is already built for this: `src/api/home.ts` maps a `waitlisted` section with
`waitlistPosition`, and the app treats those games as a distinct rail. The client is waiting on the
server here.

---

## 8 — Booking a full batch claims no seat, and cancelling it then invents one

`src/app/api/bookings/route.ts:76-88`:

```ts
if (batchId) {
  const batch = await tx.batch.findUnique({ where: { id: batchId }, select: { seats: true, coachId: true } });
  if (batch && batch.coachId === coachId && batch.seats > 0) {
    await tx.batch.update({ ... seats: { decrement: 1 } });
    const claim = await tx.coach.updateMany({ where: { id: coachId, seatsLeft: { gt: 0 } }, ... });
    if (claim.count === 0) throw new ApiError("No seats available", 409);
  }
} else {
  const claim = await tx.coach.updateMany({ ... });
  if (claim.count === 0) throw new ApiError("No seats available", 409);
}
return tx.booking.create({ data: { userId: session.id, coachId, batchId: batchId ?? null, status: "pending", note } });
```

When `batchId` names a batch that is full, belongs to another coach, or does not exist, the inner
`if` is false — and nothing happens. No error, no seat claimed. Execution falls through to
`booking.create` and the booking exists holding **no** seat.

The damage lands later. When that booking is cancelled or rejected, `transitionBooking` releases a
seat unconditionally (`bookings.ts:51-56`) because `releasesSeat("cancelled")` is true. It gives back
a seat that was never taken. Repeat it and `coach.seatsLeft` climbs past `totalSeats`, and the coach
is oversold on the listing.

The paid path gets this right: `verify:98-105` always claims the coach seat and treats the batch
decrement as the conditional extra. The free path has the nesting inverted.

**Fix.** Claim the coach seat unconditionally, exactly as `verify` does, and reject an invalid batch
rather than ignoring it:

```ts
const claim = await tx.coach.updateMany({ where: { id: coachId, seatsLeft: { gt: 0 } }, data: { seatsLeft: { decrement: 1 } } });
if (claim.count === 0) throw new ApiError("No seats available", 409);
if (batchId) {
  const batch = await tx.batch.findUnique({ where: { id: batchId }, select: { seats: true, coachId: true } });
  if (!batch || batch.coachId !== coachId) throw new ApiError("That batch is not available", 400);
  if (batch.seats <= 0) throw new ApiError("That batch is full", 409);
  await tx.batch.update({ where: { id: batchId }, data: { seats: { decrement: 1 } } });
}
```

Backfill is the `Coach.seatsLeft` rebuild in Bug 3 — it repairs both causes at once.

---

## 9 — The reliability score's review term looks up the wrong table

`src/app/api/admin/games/[id]/route.ts:83`, inside `finalize`, for each **player** `p`:

```ts
const reviewAgg = await tx.review.aggregate({ where: { coachId: p.userId }, _avg: { rating: true }, _count: true });
const reviewAvg = reviewAgg._count ? (reviewAgg._avg.rating ?? 4.5) : 4.5;
const reliabilityScore = Math.round(((attendanceRate / 100) * 0.6 + (reviewAvg / 5) * 0.4) * 5 * 10) / 10;
```

`Review.coachId` is a foreign key to `Coach.id` (`schema.prisma:272, 279`). `p.userId` is a `User.id`.
They are cuids from different tables, so the filter matches nothing, `_count` is 0, and `reviewAvg`
is **always** the 4.5 fallback.

Two consequences:

- The review term is a constant. `reliabilityScore` reduces to `attendanceRate × 0.03 + 1.8`, so a
  player with perfect attendance scores **4.8**, never 5.0. Everyone's ceiling is 4.8 and the 40% of
  the formula that was meant to be reputational is inert.
- It is displayed. `organizerRating` (`games/[id]:40`) and each player's `rating` (`:49`) are this
  field.

The intent was presumably "if this user is also a coach, factor in their coach rating". That is one
hop away:

```diff
-      const reviewAgg = await tx.review.aggregate({ where: { coachId: p.userId }, _avg: { rating: true }, _count: true });
+      const reviewAgg = await tx.review.aggregate({ where: { coach: { userId: p.userId } }, _avg: { rating: true }, _count: true });
```

Decide deliberately whether that is the rule you want — for a non-coach player there is no review
data in this schema at all, so the honest alternative is to drop the term and weight attendance at
100%. Either way the current code is not computing what it says it is. **Changing this shifts every
user's displayed rating**, so pair it with a `recomputeAll` run and expect visible movement.

---

## 10 — Workshops never complete and never archive

`cron/complete-games/route.ts` handles games, events and camps. There is no workshop branch.

`Workshop.status` therefore stays at whatever it was set to — `"open"` for the entire life of the row.
And `workshops/route.ts:15` lists on `status: { notIn: ["completed", "archived", "closed"] }`, a
filter nothing can ever satisfy. **Every workshop ever created stays on `/workshops` forever**, showing
a start date in the past.

Registration is at least blocked: `workshops/[id]:60` checks `registrationDeadline`. So this is a
stale-listing bug, not a data-integrity one — but it is the sort that grows without bound.

**Fix.** Two `updateMany` blocks in the cron, copied from the camp ones directly above them:

```ts
const workshopsCompleted = await prisma.workshop.updateMany({
  where: { status: { notIn: ["completed", "archived"] }, endDate: { lt: now } },
  data: { status: "completed" },
});
const workshopsArchived = await prisma.workshop.updateMany({
  where: { status: "completed", endDate: { lt: oneDayAgo } },
  data: { status: "archived" },
});
```

Add both counts to the response object so the job stays self-reporting.

---

## 11 — Free camp registrations are stamped "pending", so they never count for reputation

`camps/[id]/route.ts:57-59` creates the registration with `{ campId, userId, childName, childAge }` —
no `paymentStatus`. The schema default is `"pending"` (`schema.prisma:328`).

But this path is only reachable for **free** camps: `:43` rejects anything with `price > 0` as 402.
So a free camp registration is permanently marked as awaiting a payment that will never exist.

The sibling routes do it correctly and explicitly:

- `workshops/[id]:79` — `paymentStatus: (isFree ? "paid" : "pending")`
- `events/[id]:82` — the same expression

And it is load-bearing. `reputationService.ts:38-40` counts camps toward reputation as:

```ts
prisma.campRegistration.count({ where: { userId, paymentStatus: "paid", camp: { endDate: { lt: now } } } }),
```

`campsCompleted` is therefore **always 0** for anyone whose camps were free. The UI reads it too —
`users/[id]:101` returns `paymentStatus` per registration, so a free camp renders as unpaid on the
profile.

**Fix.**

```diff
       prisma.campRegistration.create({
-        data: { campId: id, userId: session.id, childName, childAge: parseInt(String(childAge)) },
+        data: { campId: id, userId: session.id, childName, childAge: parseInt(String(childAge)), paymentStatus: "paid" satisfies PaymentStatus },
       }),
```

Backfill, since existing rows are wrong:

```sql
UPDATE "CampRegistration" r
SET "paymentStatus" = 'paid'
FROM "Camp" c
WHERE r."campId" = c."id" AND c."price" = 0 AND r."paymentStatus" = 'pending';
```

Then run the reputation recompute (`/api/cron/recompute-reputation`) so the scores catch up.

---

## 12 — `/api/search` returns cancelled and archived items

`src/app/api/search/route.ts:22, 26`:

```ts
prisma.camp.findMany({       where: { status: { not: "completed" }, ... } }),
prisma.sportEvent.findMany({ where: { published: true, status: { not: "Completed" }, ... } }),
```

`not: "completed"` excludes exactly one value. It does not exclude `archived` for camps, nor
`Archived` or **`Cancelled`** for events. So the typeahead surfaces cancelled events and archived
camps, links to their detail pages, and the result is cached for 30 s on top.

`games/route.ts:20-21` states the rule for the rest of the API — *"The public list must NEVER expose
cancelled or archived games"* — and the games branch of search (`status: "open"`) happens to satisfy
it. The other two do not.

```diff
-        where: { status: { not: "completed" }, OR: [...] },
+        where: { status: { notIn: ["completed", "archived", "closed"] }, OR: [...] },
...
-        where: { published: true, status: { not: "Completed" }, OR: [...] },
+        where: { published: true, status: { notIn: ["Completed", "Archived", "Cancelled"] }, OR: [...] },
```

(These now match the list endpoints' own filters — `camps/route.ts:15` and the event status
derivation — which is the point.)

---

## 13 — The upload ceiling is above the platform's request limit

`upload/route.ts:9` sets `MAX_BYTES = 5 * 1024 * 1024` and returns 413 with `"File exceeds 5MB limit"`.
The mobile client mirrors it (`src/api/upload.ts`: `MAX_UPLOAD_BYTES`, and the 413 copy *"pick one
under 5 MB"*).

Vercel caps a serverless function's request body at **4.5 MB**, and `vercel.json` sets no override.
The route is `runtime = "nodejs"`, so it is subject to that cap. A 4.6–5.0 MB image is therefore
rejected by the platform before the handler runs — the user is told to pick something under 5 MB by
a client that will not accept 4.7 MB.

Secondary, same line: the size check happens *after* `await req.formData()` has buffered the entire
body into memory. The platform limit is what actually protects the function today; if the runtime
ever changes, that check is doing nothing it claims to.

**Fix.** Lower `MAX_BYTES` to `4 * 1024 * 1024` on both sides and adjust the copy — a 4 MB ceiling
sits safely under the cap and is ample for a photographed QR code. Alternatively move uploads to a
signed direct-to-Cloudinary flow, which removes the limit and the buffering together; that is a
larger change and not proposed here.

---

## Not fixed here, for the record

- **There is still no session revocation.** The first document's closing note flagged this. It is
  worth restating because the mobile app is already calling for it: `src/api/auth.ts:70` posts to
  `/auth/revoke`, which does not exist in the web repo. It is written as best-effort and the app
  clears local state regardless, so nothing is broken — but logout is local-only and a stolen token
  stays valid until it expires.
- **Push is entirely unimplemented server-side.** `src/api/push.ts` calls `/push/register` and
  `/push/prefs`; neither route exists. The callers in `lib/notifications.ts` treat failure as
  non-fatal, so the app registers a token on every open and silently gets a 404 each time. Not a
  bug — a documented gap — but it means no notification the PRD describes can currently fire, which
  is also why Bug 7's waitlist promotion has no way to tell anyone.
- **`/api/home` and `/api/taxonomy` likewise do not exist yet.** Both have explicit client-side
  fallbacks (`useHome` re-composes from `/games` + `/coaches`; taxonomy falls back to bundled lists),
  so these degrade correctly. Listed only so the four missing endpoints are counted together.
- **`PATCH /api/users/[id]` does not check `deletedAt`.** A JWT minted before deletion can still write
  `name`, `bio`, `phone` and `username` onto a tombstone until it expires. Small blast radius, and it
  disappears once revocation exists — but a `deletedAt` guard there is one line and matches what
  `GET` on the same file already does at `:16`.

---

## Suggested sequencing

1. **4 + 1** — the money paths. Bug 4 is a one-line fix inside a route you are already touching for
   Bug 1; do them together, with the shared predicates in `src/lib/checkout.ts`.
2. **5** — one line in `vercel.json`, and it shrinks the exposure window for several of the others.
   Deploy it *after* 4, not before: an hourly cron closes games faster, which masks the paid-join hole
   rather than fixing it.
3. **3 + 8**, then the `Coach.seatsLeft` rebuild once — both feed the same corrupted counter.
4. **2 + 6 + 11 + 12 + 10** — independent, small, no migrations. 11 needs its backfill plus a
   reputation recompute.
5. **9** — last, and deliberately: it moves every displayed rating, so it wants its own deploy and a
   note to whoever fields the "why did my score change" question.
6. **7 + 13** — product decisions, not just fixes. Neither is currently causing damage.

None of these need a migration, and none need a mobile release.
