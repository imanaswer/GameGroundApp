/** Coach query + review-mutation hooks (§6.1). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as coachesApi from "@/api/coaches";
import type { CoachSummary } from "@/api/types";
import type { CoachCardData } from "@/components/cards";
import { formatSessionRange } from "@/lib/format";

import { keys } from "./keys";

/**
 * `enabled` exists for `useHome`'s fallback path (hand-off C3): the composed `/home` endpoint is
 * the primary source, and this list is only fetched when that one fails. Defaults to on, so every
 * other caller is unaffected.
 */
export function useCoaches(filters: { sport?: string; q?: string }, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.coaches.list(filters),
    queryFn: () => coachesApi.list(filters),
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}

export function useCoach(id: string) {
  return useQuery({
    queryKey: keys.coaches.detail(id),
    queryFn: () => coachesApi.detail(id),
    staleTime: 30_000,
  });
}

export function useSubmitReview(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; body: string }) => coachesApi.submitReview(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.coaches.detail(id) }),
  });
}

export function toCoachCard(c: CoachSummary): CoachCardData {
  return {
    id: c.id,
    name: c.name,
    sport: c.sport,
    facilityImageUrl: c.facilityImageUrl,
    avatarUrl: c.avatarUrl,
    rating: c.rating,
    reviewCount: c.reviewCount,
    price: formatSessionRange(c.pricePaise, c.pricePaiseMax),
  };
}
