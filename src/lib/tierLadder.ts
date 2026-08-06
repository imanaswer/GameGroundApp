/**
 * FALLBACK reputation ladder for the profile progress bar.
 *
 * The server owns reputation, the tier ladder, and the progress arithmetic — `GG/src/lib/
 * reputation.ts` holds `TIER_THRESHOLDS` and a `progressToNextTier(score)` that already returns
 * `{ current, next, pct, pointsToNext }`. None of it is exposed on `/api/users/:id` yet, so this
 * file stands in until it is. `api/users.ts` prefers a server-sent `progress` block whenever one
 * arrives, which makes this dead code the day the server ships it — no app release required.
 *
 * **The numbers below are a MIRROR of the server's, not a guess.** They were 450/1200/2500/5000
 * against the server's 100/300/700/1500, so the profile told a 150-point player they needed 300
 * more points for a Silver the server had already given them. `__tests__/server-rules.test.ts`
 * pins them, so the next divergence fails CI instead of shipping.
 *
 * Source of truth: GG/src/lib/reputation.ts → TIER_THRESHOLDS. `GG/todo.md` §4 plans to tune
 * these after launch, which is exactly why the server should own them.
 */
import type { Tier } from "@/lib/tokens";

/** Mirrors GG/src/lib/reputation.ts TIER_THRESHOLDS. Ordered low→high. */
export const LADDER: readonly { tier: Tier; at: number }[] = [
  { tier: "bronze", at: 0 },
  { tier: "silver", at: 100 },
  { tier: "gold", at: 300 },
  { tier: "elite", at: 700 },
  { tier: "pro", at: 1500 },
] as const;

/** The tier above `current` and the points needed to reach it, or null when already at the top. */
export function nextTier(current: Tier | null): { tier: Tier; at: number } | null {
  const idx = LADDER.findIndex((l) => l.tier === (current ?? "bronze"));
  return idx >= 0 ? (LADDER[idx + 1] ?? null) : LADDER[1];
}

/** The points at which `tier` itself unlocked — the floor the progress bar measures from. */
export function tierFloor(current: Tier | null): number {
  return LADDER.find((l) => l.tier === (current ?? "bronze"))?.at ?? 0;
}

/**
 * Fraction of the way from the current tier's floor to the next tier's, 0–1.
 *
 * Measured across the SPAN, not from zero. `points / nextTierAt` overstates every tier above
 * bronze: a Silver player on 200 points sits halfway to Gold (100→300), but the raw ratio draws
 * 200/300 ≈ 67%. Mirrors the server's `progressToNextTier` pct.
 */
export function progressRatio(points: number, current: Tier | null): number {
  const lo = tierFloor(current);
  const next = nextTier(current);
  if (!next) return 1; // top tier — a full bar, not an empty one
  const span = next.at - lo;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (points - lo) / span));
}
