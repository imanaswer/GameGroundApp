/**
 * Where a successful sign-in goes next (Decision 32).
 *
 * Pulled out of the two auth screens because the rule is shared, and because it has a fallback
 * that has to be reasoned about rather than eyeballed: it prefers a server signal and degrades to
 * the old screen-based behaviour when that signal is absent.
 *
 * **The problem it solves.** Account setup used to hang off *which screen you tapped*, not off
 * whether the account was new — Decision 23 made the signup acknowledgement its only entrance. For
 * email/password that is the same thing: you only reach `register` by signing up. Social sign-in
 * broke the equivalence, because `resolveGoogleUser` / `resolveAppleUser` create-or-find silently,
 * so "Sign up with Google" is just as likely to be a returning user as a new one. The result was a
 * returning player pushed back through the five-screen new-member flow, and a genuinely new player
 * who happened to tap the Login screen never seeing it at all.
 *
 * **`isNewAccount === null` is today.** No route reports newness yet (`/auth/google/exchange` and
 * `/auth/apple/mobile` both return `{ user, token }`), so every real call currently lands on the
 * null branch and behaves exactly as before. When the server starts sending `isNew`, this function
 * is the only thing that changes behaviour — no screen edits, no release. See the website hand-off.
 */
export type AuthScreen = "login" | "signup";

export type PostAuthDestination =
  /** Into the app. The brand loader covers the transition. */
  | "home"
  /** Signup's "You have been signed in successfully" screen, whose CTA continues to setup. */
  | "acknowledge"
  /** Straight into account setup, with no acknowledgement in front of it. */
  | "setup";

export function postAuthDestination(input: {
  screen: AuthScreen;
  /** Whether this sign-in CREATED the account. `null` = the server didn't say. */
  isNewAccount: boolean | null;
}): PostAuthDestination {
  const { screen, isNewAccount } = input;

  // Known-returning: never show a new-member flow, whichever button was tapped. This is the case
  // that was actively wrong before — "Sign up with Google" by an existing player.
  if (isNewAccount === false) return "home";

  // Known-new: the new-member flow, whichever button was tapped. From signup the acknowledgement
  // leads into setup; from login there is no acknowledgement to show, so setup directly.
  if (isNewAccount === true) return screen === "signup" ? "acknowledge" : "setup";

  // Unknown — the server hasn't told us. Fall back to the pre-existing behaviour exactly, so this
  // change is inert until the server half ships: signup acknowledges, login goes straight in.
  return screen === "signup" ? "acknowledge" : "home";
}
