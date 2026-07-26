/** Global search endpoint (§3.3). Debounced by the caller (300ms). */
import { api } from "./client";
import type { SearchResults } from "./types";

export function search(q: string): Promise<SearchResults> {
  return api.get<SearchResults>(`/search?q=${encodeURIComponent(q)}`);
}
