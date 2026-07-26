/** Coaches endpoints (§3.3). Reviews have server-side eligibility rules. */
import { api } from "./client";
import type { CoachDetail, CoachReview, CoachSummary } from "./types";

export function list(params: { sport?: string; q?: string } = {}): Promise<CoachSummary[]> {
  const sp = new URLSearchParams();
  if (params.sport && params.sport !== "all") sp.set("sport", params.sport);
  if (params.q) sp.set("q", params.q);
  const s = sp.toString();
  return api.get<CoachSummary[]>(`/coaches${s ? `?${s}` : ""}`);
}

export function detail(id: string): Promise<CoachDetail> {
  return api.get<CoachDetail>(`/coaches/${id}`);
}

/** Server enforces eligibility — a 4xx maps to an inline error on the review form. */
export function submitReview(id: string, input: { rating: number; body: string }): Promise<CoachReview> {
  return api.post<CoachReview>(`/coaches/${id}/reviews`, input);
}
