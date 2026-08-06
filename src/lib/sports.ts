/**
 * The sport taxonomy the app offers as a CHOICE — account setup and profile edit both write it to
 * `users.sports` via PATCH /users/:id, so the two lists have to be one list.
 *
 * Deliberately not derived from the API: sports arrive on games and coaches as free text
 * ("BOXING/KICK", "Table Tennis"), so there is no server-side enumeration to read. This is the
 * curated set we ask about; `sportImage()` maps anything, including labels not listed here.
 */
export const SPORTS = [
  "Football",
  "Cricket",
  "Badminton",
  "Basketball",
  "Volleyball",
  "Swimming",
  "Tennis",
] as const;

/**
 * Account setup shows the first six and then an "Other" row the user types into — a first-run
 * screen is not the place to enumerate a taxonomy, and the free-text row means a sport we don't
 * list is still answerable rather than silently absent. Profile edit keeps the full list, since
 * that screen is for correcting an answer rather than giving one.
 *
 * The order matters here in a way it doesn't there: these six are what a Kozhikode player is
 * most likely to be looking for, and the sixth row is the last one visible without scrolling.
 */
export const SETUP_SPORTS = SPORTS.slice(0, 6);
