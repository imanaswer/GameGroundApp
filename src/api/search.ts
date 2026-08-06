/** Global search endpoint (§3.3). Debounced by the caller (300ms). */
import { api } from "./client";
import { END_DATE_GRACE_MS } from "./registerable";
import type { SearchHit, SearchResults } from "./types";

/**
 * A date shape, not merely a year.
 *
 * `new Date()` is far too permissive to gate on: `new Date("Whenever, 2026")` returns 1 Jan 2027,
 * so a venue name that happens to carry a year ("Kozhikode 2026") would parse as a real date. This
 * requires a month and a day next to the year — `July 14, 2026`, `20 Aug 2026`, `2026-08-20`.
 */
const DATE_LIKE =
  /[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+(?:19|20)\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s+(?:19|20)\d{2}|\d{4}-\d{2}-\d{2}/;

/**
 * The last date named in a search hit, as a timestamp — or null when there isn't one.
 *
 * Prefers a real `endDate`. Production does not send one (see `SearchHit.endDate`), so this falls
 * back to the human date line the server does send:
 *
 *   "Football · July 1 – July 14, 2026"  → 14 Jul 2026   (camp, range → take the END)
 *   "Football · Aug 20, 2026"            → 20 Aug 2026   (event, single date)
 *   "Football · Forza Turf Football"     → null          (game, no date at all)
 *
 * Parsing display copy is not something to be pleased about, and it is deliberately the fallback
 * rather than the rule: the day `/api/search` sends `endDate`, the branch above wins and this can
 * be deleted. Until then the alternative is what shipped — a filter that never filtered.
 *
 * Everything about it fails open. No "·", no year, an unparseable string, a `Date` that comes back
 * NaN: all return null, and a null keeps the hit. Hiding real content is the worse failure.
 */
export function hitEndsAt(hit: SearchHit): number | null {
  if (hit.endDate) {
    const t = new Date(hit.endDate).getTime();
    return Number.isFinite(t) ? t : null;
  }

  const tail = hit.subtitle?.split("·").pop();
  if (!tail) return null;

  // A range ("July 1 – July 14, 2026") ends at its right-hand side; the year lives there, so the
  // left side is unparseable on its own anyway. Covers en dash, em dash and hyphen.
  const end = tail.split(/[–—-]/).pop();
  const match = end?.match(DATE_LIKE);
  if (!match) return null;

  // Parse the matched substring, not the whole tail — the tail may carry trailing copy.
  const t = new Date(match[0]).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Drops hits that have already ended.
 *
 * Mirrors the Discover-list backstop in `registerable.ts`, including its 24-hour grace: a date-only
 * stamp means the item runs THROUGH that day, so without the grace a camp vanishes from search at
 * midnight on its own final day while still being listed in Discover. The two surfaces disagreeing
 * about what "ended" means is the bug class this whole file exists for.
 *
 * Only camps and events carry a date; games and coaches have none and pass through untouched.
 */
export function dropEnded(hits: SearchHit[], now: number = Date.now()): SearchHit[] {
  return hits.filter((h) => {
    const end = hitEndsAt(h);
    return end === null || end + END_DATE_GRACE_MS >= now;
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
