/**
 * Divergence guards for the rules the SERVER owns.
 *
 * The app is a client on gameground.net; the server is authoritative for prices, slots,
 * eligibility and reputation (CLAUDE.md). Where the app nonetheless keeps a local copy of a server
 * rule — because the value is not exposed over the API yet — that copy is a mirror, and a mirror
 * that silently stops matching is the whole problem. Each expectation below restates the server's
 * value as a literal, with the file it came from, so a change on either side fails here instead of
 * shipping.
 *
 * These are LITERALS on purpose. Importing from `../../GG` would couple the repos and would not
 * survive the two being cloned separately, which is how they are actually worked on.
 *
 * When the server starts sending a value, delete the guard with the fallback it protected.
 */
import { readFileSync } from "fs";
import { join } from "path";

import { LEAVE_CUTOFF_MS } from "@/api/games";
import { toProgress, type RawUserProfile } from "@/api/users";
import { SETUP_SPORTS, SPORTS } from "@/lib/sports";
import { LADDER, nextTier, progressRatio, tierFloor } from "@/lib/tierLadder";

// `@/api/games` and `@/api/users` pull in lib/env, which throws at import when
// EXPO_PUBLIC_API_URL is unset — jest does not load .env. Same stubs the other api tests use.
jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => null),
  set: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  clearAuth: jest.fn(async () => undefined),
  deviceId: jest.fn(async () => "device-1"),
}));

describe("tier ladder mirrors GG/src/lib/reputation.ts TIER_THRESHOLDS", () => {
  /** Verbatim from GG/src/lib/reputation.ts. */
  const SERVER_TIER_THRESHOLDS = {
    bronze: 0,
    silver: 100,
    gold: 300,
    elite: 700,
    pro: 1500,
  } as const;

  test("every threshold matches the server", () => {
    // `as const` on the pair keeps Object.fromEntries' entry type happy under --noEmit.
    const asMap = Object.fromEntries(LADDER.map((l) => [l.tier, l.at] as const));
    expect(asMap).toEqual(SERVER_TIER_THRESHOLDS);
  });

  test("the ladder is ordered low→high, which nextTier/tierFloor assume", () => {
    const points = LADDER.map((l) => l.at);
    expect(points).toEqual([...points].sort((a, b) => a - b));
  });

  test("nextTier walks up and stops at the top", () => {
    expect(nextTier("bronze")).toEqual({ tier: "silver", at: 100 });
    expect(nextTier("elite")).toEqual({ tier: "pro", at: 1500 });
    expect(nextTier("pro")).toBeNull();
  });

  test("nextTier treats a null tier as bronze", () => {
    expect(nextTier(null)).toEqual({ tier: "silver", at: 100 });
  });
});

describe("progressRatio measures across the tier's span, not from zero", () => {
  test("a Silver player halfway to Gold reads 50%, not 67%", () => {
    // silver floor 100, gold at 300 → 200 points is exactly halfway.
    // The pre-fix arithmetic was points / nextTierAt = 200/300 ≈ 0.67.
    expect(progressRatio(200, "silver")).toBeCloseTo(0.5, 5);
  });

  test("a player at their tier's floor reads empty", () => {
    expect(progressRatio(100, "silver")).toBe(0);
  });

  test("a player at the next threshold reads full", () => {
    expect(progressRatio(300, "silver")).toBe(1);
  });

  test("bronze still measures from zero, because its floor is zero", () => {
    expect(progressRatio(50, "bronze")).toBeCloseTo(0.5, 5);
  });

  test("the top tier is a full bar, never an empty one", () => {
    expect(progressRatio(9_999, "pro")).toBe(1);
  });

  test("out-of-range points clamp instead of overflowing the bar", () => {
    expect(progressRatio(10_000, "silver")).toBe(1);
    expect(progressRatio(-50, "silver")).toBe(0);
  });

  test("tierFloor is the threshold of the tier itself", () => {
    expect(tierFloor("gold")).toBe(300);
    expect(tierFloor(null)).toBe(0);
  });
});

describe("sport taxonomy mirrors GG/src/lib/taxonomy.ts SPORTS", () => {
  /** Verbatim from GG/src/lib/taxonomy.ts. */
  const SERVER_SPORTS = [
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
  ];

  test("the app offers exactly the sports the platform knows about", () => {
    expect([...SPORTS]).toEqual(SERVER_SPORTS);
  });

  test("no sport is offered that the server would not recognise", () => {
    // The stricter half of the above, stated on its own: a value the server does not know is
    // worse than a missing one, because it is written to users.sports and then filters nothing.
    for (const sport of SPORTS) expect(SERVER_SPORTS).toContain(sport);
  });

  test("every setup row exists in the full list", () => {
    // SETUP_SPORTS is spelled out rather than sliced, so this is the guard that keeps the
    // first-run screen from offering something profile edit cannot show.
    for (const sport of SETUP_SPORTS) expect(SERVER_SPORTS).toContain(sport);
  });

  test("setup shows six rows — the last one visible without scrolling", () => {
    expect(SETUP_SPORTS).toHaveLength(6);
  });
});

describe("rank progress prefers the server and falls back cleanly", () => {
  const base: RawUserProfile = {
    id: "u1",
    name: "Ana",
    username: "ana",
    avatarUrl: null,
    location: null,
    sports: [],
    tier: "silver",
    gamesPlayed: 0,
    gamesOrganized: 0,
    attendanceRate: 0,
    reputationScore: 200,
  };

  test("with no server block it uses the mirrored ladder and says so", () => {
    const p = toProgress(base);
    expect(p.source).toBe("fallback");
    expect(p.nextTierAt).toBe(300); // gold, per the server's thresholds
    expect(p.ratio).toBeCloseTo(0.5, 5); // 200 across the 100→300 span
  });

  test("a server pct wins over anything computed locally", () => {
    // Deliberately inconsistent with the local ladder: if the server says 10%, the bar says 10%.
    const p = toProgress({ ...base, progress: { nextAt: 300, pct: 10 } });
    expect(p.source).toBe("server");
    expect(p.ratio).toBeCloseTo(0.1, 5);
  });

  test("a server threshold alone is still authoritative for the caption", () => {
    const p = toProgress({ ...base, progress: { nextAt: 999 } });
    expect(p.source).toBe("server");
    expect(p.nextTierAt).toBe(999);
  });

  test("the server's tier wins over the flat one", () => {
    const p = toProgress({ ...base, progress: { current: "gold", nextAt: 700 } });
    expect(p.tier).toBe("gold");
  });

  test("an empty or null progress block falls back rather than drawing an empty bar", () => {
    expect(toProgress({ ...base, progress: {} }).source).toBe("fallback");
    expect(toProgress({ ...base, progress: null }).source).toBe("fallback");
    expect(toProgress({ ...base, progress: { pct: null, nextAt: null } }).ratio).toBeCloseTo(0.5, 5);
  });

  test("a nonsense server pct clamps instead of overflowing the bar", () => {
    expect(toProgress({ ...base, progress: { pct: 150 } }).ratio).toBe(1);
    expect(toProgress({ ...base, progress: { pct: -20 } }).ratio).toBe(0);
  });

  test("top tier reports no next threshold", () => {
    const p = toProgress({ ...base, tier: "pro", reputationScore: 2000 });
    expect(p.nextTierAt).toBeNull();
    expect(p.ratio).toBe(1);
  });
});

describe("leave cutoff mirrors the server's CANCEL_CUTOFF_MS", () => {
  test("90 minutes, as in GG games/camps/events [id]/route.ts", () => {
    expect(LEAVE_CUTOFF_MS).toBe(90 * 60_000);
  });

  test("the constant divides into whole minutes, since screens render it as prose", () => {
    // Two screens interpolate `LEAVE_CUTOFF_MS / 60_000` into user-visible copy.
    expect(LEAVE_CUTOFF_MS % 60_000).toBe(0);
  });
});

/**
 * Games left the payment rails (server commit aefd831, "feat: server-side work the mobile app is
 * waiting on"). `PayableEntity` no longer includes "game", `gameChargePaise` is deleted, and
 * `POST /api/payments/create-order` answers 400 "Unsupported entityType" for one.
 *
 * There is no runtime surface to assert here — `EntityType` is erased at compile time, which is
 * exactly the guard we want, so the check is that the app never NAMES a game as payable. A
 * reintroduced `useCheckout("game", …)` would fail `tsc`; this catches the looser regression of a
 * string "game" finding its way back into the payments layer.
 */
describe("player-hosted games are not payable through Game Ground", () => {
  test("the payments layer never mentions a game entity", () => {
    const src = readFileSync(join(__dirname, "..", "src", "api", "payments.ts"), "utf8");
    expect(src).not.toMatch(/["']game["']/);
  });

  test("useCheckout has no game branch", () => {
    const src = readFileSync(join(__dirname, "..", "src", "hooks", "useCheckout.ts"), "utf8");
    // The word appears in a comment explaining the absence; a CODE reference would be
    // `entityType === "game"`, which is what this rejects.
    expect(src).not.toMatch(/entityType\s*===\s*["']game["']/);
  });

  test("the game screen opens no checkout sheet", () => {
    const src = readFileSync(join(__dirname, "..", "app", "game", "[id].tsx"), "utf8");
    // Matches USE, not mention: the screen carries comments explaining why the checkout is gone,
    // and a guard that failed on its own rationale would be deleted rather than fixed.
    expect(src).not.toMatch(/<CheckoutSheet/);
    expect(src).not.toMatch(/useCheckout\s*\(/);
  });
});

/**
 * The sport mirror is now a FALLBACK behind `GET /api/taxonomy` (hand-off A2) rather than the
 * source. It must not be deleted — `useTaxonomy` degrades to it offline, against an older
 * deployment, and before the first response lands — so this asserts it still exists and still
 * matches, which is the condition that makes it a safe fallback rather than a stale one.
 */
describe("the sport mirror survives as useTaxonomy's fallback", () => {
  test("SPORTS is non-empty, so a failed taxonomy request never yields an empty picker", () => {
    expect(SPORTS.length).toBeGreaterThan(0);
  });

  test("every SETUP_SPORTS entry still exists in the full list", () => {
    for (const s of SETUP_SPORTS) expect(SPORTS as readonly string[]).toContain(s);
  });
});
