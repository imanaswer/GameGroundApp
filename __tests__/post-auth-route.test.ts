/**
 * Where a sign-in goes next (Decision 32).
 *
 * The rule this replaces keyed account setup off WHICH SCREEN was tapped. For email/password that
 * is the same question as "is this a new member" — you only reach `register` by signing up. Social
 * sign-in broke the equivalence: the Google and Apple routes create-or-find silently, so
 * "Sign up with Google" is as likely to be a returning player as a new one.
 *
 * The null column is today's behaviour and the reason this is safe to ship before the server half:
 * every real call currently lands there, and every null case below asserts the pre-existing route.
 */
import { postAuthDestination } from "@/lib/postAuthRoute";

describe("the server knows the account is new", () => {
  test("signup shows the acknowledgement, which leads into setup", () => {
    expect(postAuthDestination({ screen: "signup", isNewAccount: true })).toBe("acknowledge");
  });

  test("login goes to setup too — a new member is a new member whichever button they tapped", () => {
    // There is no acknowledgement on the login screen to show first, so setup directly.
    expect(postAuthDestination({ screen: "login", isNewAccount: true })).toBe("setup");
  });
});

describe("the server knows the account already existed", () => {
  test("signup skips the new-member flow entirely", () => {
    // The case that was actively wrong: a returning player tapping "Sign up with Google" was
    // marched back through five screens they had finished months earlier.
    expect(postAuthDestination({ screen: "signup", isNewAccount: false })).toBe("home");
  });

  test("login goes home, as it always did", () => {
    expect(postAuthDestination({ screen: "login", isNewAccount: false })).toBe("home");
  });
});

describe("the server said nothing — today, and the fallback that keeps this inert", () => {
  test("signup acknowledges, exactly as before", () => {
    expect(postAuthDestination({ screen: "signup", isNewAccount: null })).toBe("acknowledge");
  });

  test("login goes straight home, exactly as before", () => {
    expect(postAuthDestination({ screen: "login", isNewAccount: null })).toBe("home");
  });

  test("null is not treated as false — the two route differently from signup", () => {
    // `isNew ?? null` in useAuth exists for this: collapsing "didn't say" into "no" would send a
    // brand-new social signup straight past the acknowledgement and setup.
    expect(postAuthDestination({ screen: "signup", isNewAccount: null })).not.toBe(
      postAuthDestination({ screen: "signup", isNewAccount: false }),
    );
  });
});

test("every combination resolves to a real destination", () => {
  const screens = ["login", "signup"] as const;
  const flags = [true, false, null];
  for (const screen of screens) {
    for (const isNewAccount of flags) {
      expect(["home", "acknowledge", "setup"]).toContain(
        postAuthDestination({ screen, isNewAccount }),
      );
    }
  }
});
