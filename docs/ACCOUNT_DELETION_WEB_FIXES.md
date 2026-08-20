# Account deletion — Web Repo Fix Plan

**Repo:** `gameground.net` (Next.js + Prisma). **No mobile app change is required for any of these**
(one optional courtesy warning is noted under Bug 3).

Three defects, found while testing account deletion on mobile. All of them affect **the website too**,
not just the app.

| | What | Ship independently? |
|---|---|---|
| **Bug 1** | Deletion never releases the Google/Apple identity — the next sign-in revives the tombstone | yes |
| **Bug 2** | `isNew` is never returned, so first-time Google users skip onboarding | yes |
| **Bug 3** | Deletion abandons hosted games and leaks seats out of joined ones | yes |

Bugs 1 and 3 are both live data-integrity problems in the same `DELETE` handler and are naturally one
PR; they are written up separately because they fail in unrelated ways.

---

## Reproduction

1. Sign in with Google (account already exists).
2. Delete the account (`DELETE /api/users/:id`, "Danger zone" on Edit profile).
3. Sign in with the **same** Google account again.

**Expected:** a brand-new account, routed into account setup.
**Actual:** you are signed in as the *deleted* account. You land on Home, and every profile screen
answers `404 "User not found"`.

Same result on the website: after step 2, "Continue with Google" on gameground.net revives the dead
account and the profile page 404s.

---

## Bug 1 — deletion never releases the Google/Apple identity

`src/app/api/users/[id]/route.ts:193` — `DELETE` is a **soft** delete. It sets `deletedAt`, scrambles
`email` and `username`, and nulls `phone` / `avatarUrl` / `bio` / `reputationOverride`. It leaves
**`googleId` and `appleId` intact**.

`src/lib/google.ts:147` — `resolveGoogleUser` step 1 is:

```ts
const byGoogle = await prisma.user.findUnique({ where: { googleId: profile.sub }, select: SELECT });
if (byGoogle) return toSessionUser(byGoogle);
```

No `deletedAt` filter. So the next Google sign-in matches the tombstone and returns it as the session
user — the server mints a valid JWT for a deleted account.

`src/lib/apple.ts:85` (`resolveAppleUser`, lookup by `appleId`) has the identical hole.

Downstream, everything else *does* filter correctly, which is why the session looks half-alive:

| Endpoint | Behaviour | Result |
|---|---|---|
| `google/callback:46` → `resolveGoogleUser` | no `deletedAt` filter | signs you in |
| `users/[id]:16` | `if (!user \|\| user.deletedAt) return fail("User not found", 404)` | **the error the user sees** |
| `auth/me:17` | rejects + clears cookie | force-signs-out on next cold start |

### Fix 1a — release the identifiers on delete (required)

`src/app/api/users/[id]/route.ts`, inside the `prisma.user.update` of the delete transaction:

```diff
       prisma.user.update({
         where: { id },
         data: {
           deletedAt: new Date(),
           email: `deleted-${id}-${stamp}@deleted.local`,
           username: `deleted_${id}_${stamp}`,
+          // Both are @unique. Leaving them set means the next social sign-in resolves straight
+          // back to this tombstone — and, because of the unique constraint, a fresh `create`
+          // could never take their place either.
+          googleId: null,
+          appleId: null,
           phone: null,
           avatarUrl: null,
           bio: null,
           reputationOverride: null,
         },
       }),
```

(Fix 3 rewrites this same transaction into its interactive form and already carries these two lines —
apply that version, not both diffs.)

**This one is not optional and not merely tidy.** `googleId` and `appleId` are `@unique`. If you only
add a `deletedAt` filter to the resolvers (1b) without clearing the columns, `resolveGoogleUser` falls
through to step 3's `prisma.user.create`, hits a P2002 unique violation, and the recovery path at
`google.ts:180-186` re-looks-up by `googleId` and hands back **the same tombstone**. The bug survives
the fix.

### Fix 1b — filter soft-deleted users in both resolvers (defence in depth)

`findUnique` can't take a non-unique filter, so these become `findFirst`.

`src/lib/google.ts`:

```diff
-  const byGoogle = await prisma.user.findUnique({ where: { googleId: profile.sub }, select: SELECT });
+  const byGoogle = await prisma.user.findFirst({
+    where: { googleId: profile.sub, deletedAt: null },
+    select: SELECT,
+  });
   if (byGoogle) return toSessionUser(byGoogle);

-  const byEmail = await prisma.user.findUnique({ where: { email: profile.email }, select: { ...SELECT, googleId: true } });
+  const byEmail = await prisma.user.findFirst({
+    where: { email: profile.email, deletedAt: null },
+    select: { ...SELECT, googleId: true },
+  });
```

Apply the same two changes to `resolveAppleUser` in `src/lib/apple.ts:85` and `:105`, and to the
P2002 recovery re-lookups at `google.ts:183-184`.

(The email lookups are belt-and-braces — deletion already scrambles the address — but they keep the
invariant "a soft-deleted row is never a sign-in target" true in one place rather than three.)

### Fix 1c — reject deleted users at the mobile code exchange

`src/app/api/auth/google/exchange/route.ts:36` selects `USER_SELECT`, which has no `deletedAt`, and
only fails on `!user`. A handoff code minted seconds before deletion is still redeemable afterwards.

```diff
   const user = await prisma.user.findUnique({
     where: { id: result.userId },
-    select: USER_SELECT,
+    select: { ...USER_SELECT, deletedAt: true },
   });
-  if (!user) return fail("This sign-in link is no longer valid. Please try again.", 401);
+  if (!user || user.deletedAt) return fail("This sign-in link is no longer valid. Please try again.", 401);
```

(`toSessionUser` ignores the extra field, so no other change is needed.)

### Fix 1d — backfill existing tombstones (required)

Accounts already deleted still hold their `googleId` / `appleId`, so they stay broken no matter what
ships. One statement, safe to re-run:

```sql
UPDATE "User"
SET "googleId" = NULL, "appleId" = NULL
WHERE "deletedAt" IS NOT NULL
  AND ("googleId" IS NOT NULL OR "appleId" IS NOT NULL);
```

Run it **after** deploying 1a, so no in-flight delete can reintroduce a row.

### Verifying

- Delete an account → sign in with the same Google account → you get a **new** user id, an empty
  profile, and `GET /api/users/:id` returns 200.
- Sign in with an untouched existing Google account → same user id as before (no regression on the
  link-by-email path).
- The old id still 404s on `/api/users/:oldId` and no longer appears in leaderboards.

---

## Bug 2 — `isNew` is still never returned

Independent of Bug 1, and the reason a genuinely new Google user skips onboarding.

`exchange/route.ts:44` returns `{ user, token }`. The app's router
(`src/lib/postAuthRoute.ts` in the mobile repo) already handles the flag:

| `isNew` | from Signup screen | from Login screen |
|---|---|---|
| `true` | acknowledgement → setup | **setup** |
| `false` | home | home |
| absent | acknowledgement | **home** ← today, for everyone |

Because the field never arrives, a first-ever Google user who tapped **Login** lands on Home and
never sees account setup. The app types it as optional (`isNew?: boolean`), so **Bug 1 can ship on its
own** — nothing breaks while this is outstanding.

### Where the plumbing gets awkward

Apple is trivial: `/api/auth/apple/mobile` calls `resolveAppleUser` and returns in the same request.
Have the resolver return `{ user, isNew }` and pass it through.

Google is not, because of the browser hop:

```
app → /api/auth/google → google → /api/auth/google/callback   ← knows isNew (calls resolveGoogleUser)
                                → /api/auth/google/handoff    ← mints the one-time code
                                → app → /api/auth/google/exchange  ← returns { user, token }
```

The route that *learns* `isNew` is not the route that *mints the code*, and `MobileAuthCode`
(`schema.prisma:70`) has nowhere to put it. Two ways forward:

**Option A — carry it properly (recommended).**
1. `resolveGoogleUser` returns `{ user, isNew }`.
2. `callback` sets a short-lived `httpOnly` cookie (e.g. `gg_oauth_new=1`, `maxAge: 120`) when
   `isNew`. Not a query param — that one is user-forgeable.
3. `handoff` reads and clears that cookie and passes the flag to `issueCode`.
4. Add `isNew Boolean @default(false)` to `MobileAuthCode` + migration; `redeemCode` returns it.
5. `exchange` returns `{ user, token, isNew }`.

Costs a migration; the answer is exact.

**Option B — infer it in `exchange` (no migration).**
Select `createdAt` alongside the user and set `isNew = Date.now() - user.createdAt.getTime() < 120_000`.
The handoff code TTL is 90s (`mobileHandoff.ts:18`), so anything older than the window cannot have
been created by this sign-in. Imprecise only in one direction: someone who registered on the web
within the last two minutes and then signs in on mobile is flagged new — which arguably *should*
send them to setup anyway.

Ship whichever you prefer; the app treats the two identically.

> Worth a separate conversation: `isNew` answers "did this request create the row", but what the app
> actually wants to know is "should this person go through setup". A user who abandons setup halfway
> never gets offered it again. A `setupCompletedAt` column would be the durable version. Out of scope
> here — flagging it rather than proposing it.

---

## Bug 3 — deletion abandons hosted games and leaks seats out of joined ones

**Asked directly: are hosted and joined games removed?** Joined games, yes. Hosted games, **no** —
they are not touched at all. And the joined-game cleanup is itself incomplete.

`src/app/api/users/[id]/route.ts:200-216` — the whole delete transaction is four statements:

```ts
prisma.review.updateMany({ where: { userId: id }, data: { reviewerName: "Deleted User" } }),
prisma.gamePlayer.deleteMany({ where: { userId: id } }),   // ← joined games: rows removed
prisma.booking.updateMany({ where: { userId: id }, data: { status: "cancelled" } }),
prisma.user.update({ /* tombstone */ }),
```

There is no statement anywhere in the file that filters on `organizerId`.

### 3a — hosted games stay live, joinable, and holding their venue slot

A deleted user's `Game` rows keep `status: "open"`. `GET /api/games` (`games/route.ts:23-41`) filters
only on status/sport/level/cost — never on the organizer — so those games stay on the public browse
list, and `POST /api/games/:id` will happily let someone join a game whose host no longer exists.

The slot leaks too. `Game.slotId` is `@unique` and is released **only** by the cancel route
(`games/[id]/cancel/route.ts:39` sets `slotId: null`). A deleted host's game holds its `VenueSlot`
permanently, so that slot can never be booked again.

And the game is unusable even if someone joins it: deletion nulls `phone`, so
`organizerPhone` (`games/[id]/route.ts:43`) returns `null` and the tap-to-chat link the game page
promises is dead — while `POST /api/games` (`games/route.ts:78-81`) *refuses to let you host at all*
without a WhatsApp number. The invariant the create path enforces is silently broken by the delete path.

### 3b — the deleted user's real name is still on those games

Deletion scrambles `email` and `username` but leaves **`name`** untouched. `GET /api/games` returns
`organizerName: g.organizer?.name` (`games/route.ts:60`) and the detail route returns `organizerName`
plus `organizer.avatarUrl` (`games/[id]/route.ts:27-42`). Reviews are anonymised to `"Deleted User"`;
game listings are not, so a deleted account's real name keeps appearing publicly.

### 3c — joined games are removed, but the seat never comes back

`gamePlayer.deleteMany` is a bare delete. Compare the LEAVE endpoint (`games/[id]/route.ts:143-149`),
which does the same delete **plus**:

```ts
prisma.game.update({
  where: { id },
  data: { slotsLeft: { increment: 1 }, status: game.status === "full" ? "open" : undefined },
}),
```

So every game the deleted user had joined permanently loses a seat, and a game that was `full` stays
`full` forever — `joinability()` blocks new joins, and nobody can take the vacated place. The
invariant `slotsLeft = slots - 1 - playerCount` (host takes one seat at create, no `GamePlayer` row —
see the comment at `games/route.ts:128-133`) is broken for every affected game.

### 3d — waitlist entries survive

`WaitlistEntry` has no cascade and is not in the delete transaction; it is only cleaned up on admin
game delete (`admin/games/[id]/route.ts:120`). Dead rows keep their `position`, and the next entrant's
position is computed as `count + 1` (`games/[id]/route.ts:100`), so positions drift.

### Fix 3 — one interactive transaction

The seat give-back needs a read before the writes, so convert the delete to
`prisma.$transaction(async tx => …)` rather than the array form. That also closes the read/write race.

```ts
const stamp = Date.now();
await prisma.$transaction(async (tx) => {
  // Seats to hand back: only games that haven't happened yet. Bumping slotsLeft on a
  // completed game would make a finished game look joinable.
  const joined = await tx.gamePlayer.findMany({
    where: { userId: id, game: { status: { in: ["open", "full"] } } },
    select: { gameId: true, game: { select: { status: true } } },
  });

  await tx.review.updateMany({ where: { userId: id }, data: { reviewerName: "Deleted User" } });
  await tx.gamePlayer.deleteMany({ where: { userId: id } });
  await tx.waitlistEntry.deleteMany({ where: { userId: id } });            // 3d
  await tx.booking.updateMany({ where: { userId: id }, data: { status: "cancelled" } });

  // 3c — release each seat, and reopen anything that was full only because of it.
  for (const { gameId, game } of joined) {
    await tx.game.update({
      where: { id: gameId },
      data: {
        slotsLeft: { increment: 1 },
        ...(game.status === "full" ? { status: "open" } : {}),
      },
    });
  }

  // 3a — cancel still-live hosted games, releasing their venue slots. Past and
  // completed games are left alone: they are historical record.
  await tx.game.updateMany({
    where: { organizerId: id, status: { in: ["open", "full"] } },
    data: { status: "cancelled", cancelledAt: new Date(), slotId: null },
  });

  await tx.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      email: `deleted-${id}-${stamp}@deleted.local`,
      username: `deleted_${id}_${stamp}`,
      name: "Deleted User",     // 3b — match how reviews are anonymised
      googleId: null,           // Fix 1a
      appleId: null,            // Fix 1a
      phone: null,
      avatarUrl: null,
      bio: null,
      reputationOverride: null,
    },
  });
});
```

(`updateMany` setting `slotId: null` across several rows is safe — Postgres treats NULLs as distinct
under a unique index.)

### The policy call in 3a

Cancelling those games deliberately bypasses the rule at `cancel/route.ts:27-32`, where a host may
**not** cancel a game people have already joined ("please contact an administrator"). Deletion has to
resolve to *something*, and the alternatives are:

- **Cancel them (above, recommended).** Always completable, no dead-end. Cost: joined players find
  out by seeing the game cancelled, with no notification path today.
- **Block deletion while the user hosts an upcoming game with players.** Consistent with the cancel
  rule, but it makes account deletion conditional — awkward against Apple's requirement that deletion
  be initiable in-app, and it strands a user who cannot reach an admin.

If you take the recommended path, the one worthwhile **app-side** addition is a confirmation line on
the Danger Zone sheet — "You host 2 upcoming games. Deleting your account cancels them." That needs a
count the API does not expose yet; say the word and I will spec it.

### Fix 3e — backfill (required)

Accounts already deleted have live hosted games, leaked seats, and their real names on display.

```sql
-- Cancel still-live games hosted by deleted accounts, releasing their venue slots.
UPDATE "Game" g
SET "status" = 'cancelled', "cancelledAt" = NOW(), "slotId" = NULL
FROM "User" u
WHERE g."organizerId" = u."id"
  AND u."deletedAt" IS NOT NULL
  AND g."status" IN ('open', 'full');

-- Anonymise existing tombstones.
UPDATE "User" SET "name" = 'Deleted User'
WHERE "deletedAt" IS NOT NULL AND "name" <> 'Deleted User';

-- Rebuild slotsLeft from ground truth for every live game. The deleted GamePlayer rows
-- are gone, so the leak cannot be replayed — but the invariant can be recomputed.
-- Safe to re-run; also repairs drift from any other cause.
UPDATE "Game" g
SET "slotsLeft" = GREATEST(g."slots" - 1 - c.n, 0),
    "status"    = CASE WHEN g."status" = 'full' AND g."slots" - 1 - c.n > 0
                       THEN 'open' ELSE g."status" END
FROM (SELECT g2."id", (SELECT COUNT(*) FROM "GamePlayer" p WHERE p."gameId" = g2."id") AS n
      FROM "Game" g2 WHERE g2."status" IN ('open', 'full')) c
WHERE g."id" = c."id";

-- Waitlist rows belonging to deleted accounts.
DELETE FROM "WaitlistEntry" w
USING "User" u
WHERE w."userId" = u."id" AND u."deletedAt" IS NOT NULL;
```

Run these **after** deploying Fix 3, in this order (the slot cancellation must land before the
`slotsLeft` rebuild, so cancelled games drop out of the `IN ('open','full')` set).

### Verifying

- Host a game, join a second game as the same user, delete the account →
  the hosted game reads `cancelled` with `slotId: null` and is gone from `GET /api/games`;
  the joined game's `slotsLeft` went **up** by one and a `full` game flipped back to `open`.
- Re-run the `slotsLeft` rebuild: it changes zero rows.
- The venue slot the cancelled game held is bookable again.

### Adjacent, not fixed here

Camp / event / workshop registrations are not touched by deletion either. Those rows survive with
`status: "registered"` / `"approved"`, and the seat stays consumed — `participants` is incremented on
register (`camps/[id]/route.ts:58`, `events/[id]/route.ts:75`, `workshops/[id]/route.ts:77`) and
decremented only on explicit cancel. So a deleted user remains a phantom paying attendee on an
organiser's roster. Unlike games this is at least *internally consistent* (row and counter agree), and
refunds make it a money question rather than a data-integrity one — which is why I am flagging it
rather than proposing a fix. Same for `Payment` / `PaymentOrder` rows, which are deliberately
immutable financial record and should stay.

One more, for the record: `gamePlayer.deleteMany` has no date filter, so it also erases the deleted
user from **past, finalized** games — a completed game's roster silently shrinks. Rewards were granted
at finalization and are not reversed, so nothing is miscounted; the historical record is just
incomplete. Anonymising instead of deleting would preserve it, at the cost of a `GamePlayer` row that
outlives its user. Left as is unless you want the change.

---

## Suggested sequencing

1. **1a + 1b + 1c + 3** in one PR — both are live bugs in the same handler, no migration, no app
   release needed.
2. **1d + 3e** immediately after deploy, 1d first.
3. **2** whenever convenient; the app already handles both the presence and the absence of the field.

## Note, not a fix

A JWT issued *before* deletion stays valid until it expires. `/auth/me` catches it on the next cold
start and `users/[id]` 404s, so the practical blast radius is small — but there is no revocation on
delete today. Mentioning it for the record; it is a separate piece of work.
