/** Global search endpoint (§3.3). Debounced by the caller (300ms). */
import { api } from "./client";
import type { SearchHit, SearchResults } from "./types";

/**
 * Drops hits that have already ended.
 *
 * Mirrors the Discover-list backstop in `registerable.ts`. The server guards this too, but search
 * was the surface that fix originally missed: camps and events were filtered on status alone, so
 * anything the nightly completion cron had not swept stayed findable after it ended.
 *
 * Only camp and event hits carry `endDate`; games and coaches have none and pass through
 * untouched. A hit with no usable date is kept — hiding real content is the worse failure.
 */
export function dropEnded(hits: SearchHit[], now: number = Date.now()): SearchHit[] {
  return hits.filter((h) => {
    if (!h.endDate) return true;
    const t = new Date(h.endDate).getTime();
    return !Number.isFinite(t) || t >= now;
  });
}

export async function search(q: string): Promise<SearchResults> {
  const r = await api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
  const now = Date.now();
  return {
    ...r,
    camps: dropEnded(r.camps ?? [], now),
    events: dropEnded(r.events ?? [], now),
  };
}
