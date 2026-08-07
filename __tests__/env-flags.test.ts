/**
 * Build-flag polarity (Decision 31).
 *
 * `EXPO_PUBLIC_APPLE_AUTH_ENABLED` gates a **compliance requirement**, not a feature, so an
 * environment that has never heard of it must comply rather than opt out. Written `=== "true"` it
 * did the opposite: a fresh clone, an untouched local `.env`, or a CI job that didn't set it all
 * built an App Store rejection, and the only symptom was a button that quietly wasn't there.
 *
 * These read `src/lib/env.ts` through a fresh module registry per case, because the flag is
 * evaluated once at import from `process.env`.
 */
type Env = { appleAuthEnabled: boolean };

/* eslint-disable @typescript-eslint/no-require-imports */
const loadEnv = (): Env => (require("@/lib/env") as { env: Env }).env;

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { appEnv: "test" } } },
}));

const ORIGINAL = process.env;

beforeEach(() => {
  jest.resetModules();
  // `env.ts` throws at import without this one, by design (§2.4).
  process.env = { ...ORIGINAL, EXPO_PUBLIC_API_URL: "https://api.test" };
});

afterAll(() => {
  process.env = ORIGINAL;
});

test("unset means ENABLED — forgetting the flag must not ship a 4.8 rejection", () => {
  delete process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED;
  expect(loadEnv().appleAuthEnabled).toBe(true);
});

test('"false" is the only way to turn it off, and it works', () => {
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED = "false";
  expect(loadEnv().appleAuthEnabled).toBe(false);
});

test('"true" stays enabled — eas.json sets it explicitly', () => {
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED = "true";
  expect(loadEnv().appleAuthEnabled).toBe(true);
});

test("an empty value is not a disable — a blank line in .env means nothing was said", () => {
  process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED = "";
  expect(loadEnv().appleAuthEnabled).toBe(true);
});

test("a typo does not silently disable it", () => {
  // "False", "0", "no" are the shapes a human reaches for. None of them is the documented value,
  // and guessing at intent here would hide a misconfiguration behind a missing button again.
  for (const value of ["False", "FALSE", "0", "no", "off"]) {
    jest.resetModules();
    process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED = value;
    expect(loadEnv().appleAuthEnabled).toBe(true);
  }
});
