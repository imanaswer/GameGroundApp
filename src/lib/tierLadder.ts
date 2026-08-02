/**
 * PROVISIONAL reputation ladder for the profile progress bar. The server owns reputation and the
 * user's tier, but exposes no per-tier thresholds — so the "N pts · Silver at 450" progress reads
 * from this ladder until it does. Ordered low→high. Replace with server thresholds when they ship.
 */
import type { Tier } from "@/lib/tokens";

const LADDER: { tier: Tier; at: number }[] = [
  { tier: "bronze", at: 0 },
  { tier: "silver", at: 450 },
  { tier: "gold", at: 1200 },
  { tier: "elite", at: 2500 },
  { tier: "pro", at: 5000 },
];

/** The tier above `current` and the points needed to reach it, or null when already at the top. */
export function nextTier(current: Tier | null): { tier: Tier; at: number } | null {
  const idx = LADDER.findIndex((l) => l.tier === (current ?? "bronze"));
  return idx >= 0 ? (LADDER[idx + 1] ?? null) : LADDER[1];
}
