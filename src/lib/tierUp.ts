/**
 * Tier-up decision (M14) — pure, in its own module so tests don't load the reanimated overlay.
 * Celebrate only on a genuine increase; record silently on first observation; else skip, so a
 * tier-up fires exactly once (product AC 6.6.1).
 */
import type { Tier } from "@/lib/tokens";

const RANK: Record<Tier, number> = { bronze: 0, silver: 1, gold: 2, elite: 3, pro: 4 };

export function tierUpDecision(current: Tier, lastSeen: string | null): "celebrate" | "record" | "skip" {
  if (lastSeen == null) return "record";
  const lastRank = lastSeen in RANK ? RANK[lastSeen as Tier] : -1;
  return RANK[current] > lastRank ? "celebrate" : "skip";
}
