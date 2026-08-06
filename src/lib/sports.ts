/**
 * The sport taxonomy the app offers as a CHOICE — account setup and profile edit both write it to
 * `users.sports` via PATCH /users/:id, so the two lists have to be one list.
 *
 * **This mirrors `GG/src/lib/taxonomy.ts` → SPORTS.** The previous comment here said there was no
 * server-side enumeration to read; there is, it is simply a server module rather than an endpoint,
 * so nothing in the app could reach it. The lists had drifted to 7 entries against the server's 11:
 * Table Tennis, Athletics, Fitness and Multi-Sport were unpickable in the app even though the
 * platform supports them and coaches offer them. `__tests__/server-rules.test.ts` pins the set.
 *
 * Sports still arrive on games and coaches as free text ("BOXING/KICK"), so this is the set we
 * ASK about, not a closed enumeration of what exists; `sportImage()` maps anything, listed or not.
 *
 * Retiring this file is a server change — see the hand-off note's taxonomy endpoint.
 */

/** Mirrors GG/src/lib/taxonomy.ts SPORTS, in the server's order. */
export const SPORTS = [
  "Football",
  "Cricket",
  "Basketball",
  "Badminton",
  "Tennis",
  "Swimming",
  "Table Tennis",
  "Volleyball",
  "Athletics",
  "Fitness",
  "Multi-Sport",
] as const;

/**
 * Account setup shows six rows and then an "Other" the user types into — a first-run screen is not
 * the place to enumerate a taxonomy, and the free-text row means a sport we don't list is still
 * answerable rather than silently absent. Profile edit keeps the full list, since that screen is
 * for correcting an answer rather than giving one.
 *
 * **Spelled out rather than `SPORTS.slice(0, 6)`.** These six are what a Kozhikode player is most
 * likely to be looking for, and the sixth is the last row visible without scrolling — that is a
 * product decision about this screen, and it must not shift because the server's taxonomy was
 * reordered or extended. Every entry must exist in SPORTS; the test asserts it.
 */
export const SETUP_SPORTS = [
  "Football",
  "Cricket",
  "Badminton",
  "Basketball",
  "Volleyball",
  "Swimming",
] as const;
