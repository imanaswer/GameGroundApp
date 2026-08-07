/**
 * `scripts/release-check.sh` is the gate that blocks a release cut when a secret reaches the JS
 * bundle. It is only useful while it is BOTH strict on real secrets and silent on a clean tree.
 *
 * It failed the second half. Its secret-name alternation was bare (`|AUTH_SECRET|KEY_SECRET|…`),
 * so it matched the user-facing error string in `src/lib/razorpay-errors.ts` — which is supposed to
 * be in the bundle and contains no secret — and every production cut exited 1. The script's own
 * header warns about exactly that trap for `rzp_live_`: "a bare grep would fail every production
 * cut and train people to bypass the gate."
 *
 * This test guards both halves at once, and follows the precedent set by `sentry-init.test.ts`,
 * which keeps `app.config.js`'s DSN regex character-identical to `src/lib/sentry.ts`'s: when a rule
 * lives in two languages, assert the copies agree rather than trusting they do.
 *
 * 1. The shell source still assembles the pattern the way this file mirrors it (character-identical
 *    lines) — so a change to the script that this test has not seen fails here.
 * 2. The mirrored pattern catches five planted secrets of every shape the script claims to cover.
 * 3. The mirrored pattern is silent on the REAL error message, read from the real source file, so
 *    the fixture cannot drift away from what actually ships.
 */
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const script = readFileSync(join(ROOT, "scripts", "release-check.sh"), "utf8");
const razorpayErrors = readFileSync(join(ROOT, "src", "lib", "razorpay-errors.ts"), "utf8");

/**
 * The exact lines that build `$PATTERN`. Kept verbatim, including the bash quote-escaping, so the
 * failure message points straight at what changed.
 */
const SHELL_LINES = [
  `BIND='["'"'"'\\\`]?[[:space:]]*[:=][[:space:]]*["'"'"'\\\`][A-Za-z0-9_/+-]{8,}'`,
  `PATTERN='sk_live_[A-Za-z0-9]+'`,
  `PATTERN="$PATTERN"'|(AUTH_SECRET|KEY_SECRET|key_secret|keySecret)'"$BIND"`,
  `PATTERN="$PATTERN"'|rzp_(live|test)_[A-Za-z0-9]+:[A-Za-z0-9]{8,}'`,
  `PATTERN="$PATTERN"'|eyJ[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]+'`,
];

/**
 * The same rule as a JS RegExp. `[[:space:]]` is POSIX-class syntax that JS spells `\s`; nothing
 * else differs. If you change the shell pattern, change this and the SHELL_LINES above together —
 * test 1 is what makes that non-optional.
 */
const BIND = String.raw`["'\`]?\s*[:=]\s*["'\`][A-Za-z0-9_/+-]{8,}`;
const PATTERN = new RegExp(
  [
    String.raw`sk_live_[A-Za-z0-9]+`,
    String.raw`(AUTH_SECRET|KEY_SECRET|key_secret|keySecret)` + BIND,
    String.raw`rzp_(live|test)_[A-Za-z0-9]+:[A-Za-z0-9]{8,}`,
    String.raw`eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]+`,
  ].join("|"),
);

describe("release-check.sh secret pattern", () => {
  test("the shell script still assembles the pattern this file mirrors", () => {
    for (const line of SHELL_LINES) expect(script).toContain(line);
  });

  test("the secret-name alternation is bound to a value, never bare", () => {
    // The regression itself: `|AUTH_SECRET|` with no binding matches prose.
    expect(script).not.toMatch(/PATTERN=.*\|AUTH_SECRET\|KEY_SECRET\|key_secret\|keySecret'$/m);
    expect(script).toContain(`(AUTH_SECRET|KEY_SECRET|key_secret|keySecret)'"$BIND"`);
  });

  /**
   * **Every fixture below is synthetic — never paste a real credential in here.** A test file is
   * committed, pushed and (for this repo) publicly readable, so a "just for the test" secret is a
   * leaked secret with extra steps, and rotating it afterwards does not remove it from git history.
   * These strings only need to match the *shape* the patterns look for; their contents are invented.
   */
  test.each([
    ["object literal secret", `var a={keySecret:"EXAMPLEsecret0123456789"};`],
    ["assigned auth secret", `process.env.AUTH_SECRET='super-secret-value-here'`],
    ["live stripe key", `var b="sk_live_51H8xQwErTyUiOpAsDf";`],
    ["razorpay id:secret pair", `"rzp_test_EXAMPLEkeyid01:EXAMPLEsecret0123456789"`],
    [
      "jwt",
      `"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.dozjgNryP4J3jVmNHl0w5N"`,
    ],
  ])("still catches a planted secret: %s", (_label, sample) => {
    expect(PATTERN.test(sample)).toBe(true);
  });

  test("is silent on the real RazorpayNotConfiguredError message", () => {
    // Read from source, not retyped — the fixture cannot drift from what ships.
    const message = razorpayErrors.match(/super\("(Payments[^"]+)"\)/)?.[1];
    expect(message).toBeDefined();
    expect(message).toContain("RAZORPAY_KEY_SECRET");
    expect(PATTERN.test(message as string)).toBe(false);
  });

  test("is silent on the whole razorpay-errors module", () => {
    expect(PATTERN.test(razorpayErrors)).toBe(false);
  });
});
