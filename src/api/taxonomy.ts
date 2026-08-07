/**
 * Reference data the server publishes (`GET /api/taxonomy`, hand-off A2).
 *
 * `GG/src/lib/taxonomy.ts` has always held the real lists, but it is a server module — nothing in
 * this app could reach it, so `src/lib/sports.ts` carried a hand-copied mirror that had already
 * drifted once (7 entries against the server's 11, making four supported sports unpickable here).
 * This endpoint is the fix: one published list, read at runtime.
 *
 * **The mirror stays as a fallback, deliberately.** This request can fail — offline, an older
 * deployment without the route, a cold start racing the first render — and a sport picker with no
 * sports is a broken screen. `useTaxonomy` degrades to the local list, so the worst case is the
 * behaviour we had before this endpoint existed rather than an empty form.
 *
 * The server caches for an hour (`okCached(..., 3600)`); the query mirrors that rather than
 * refetching a list that changes a few times a year.
 */
import { api } from "./client";

export interface Taxonomy {
  sports: string[];
  skillLevels: string[];
  coachTypes: string[];
  eventTypes: string[];
}

/** Anything missing or non-array is dropped here, so a partial payload can't reach a picker. */
function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out = value.filter((v): v is string => typeof v === "string" && v.length > 0);
  return out.length > 0 ? out : null;
}

/**
 * Narrowed at the boundary rather than cast. `extra`-style trust cost a launch-time
 * `raw?.trim is not a function` once already (see `src/lib/env.ts`); a picker mapping over a
 * non-array would fail the same way, one screen deeper where it is harder to trace.
 */
export async function getTaxonomy(): Promise<Partial<Taxonomy>> {
  const raw = await api.get<Record<string, unknown>>("/taxonomy");
  return {
    ...(stringList(raw?.sports) ? { sports: stringList(raw.sports)! } : {}),
    ...(stringList(raw?.skillLevels) ? { skillLevels: stringList(raw.skillLevels)! } : {}),
    ...(stringList(raw?.coachTypes) ? { coachTypes: stringList(raw.coachTypes)! } : {}),
    ...(stringList(raw?.eventTypes) ? { eventTypes: stringList(raw.eventTypes)! } : {}),
  };
}
