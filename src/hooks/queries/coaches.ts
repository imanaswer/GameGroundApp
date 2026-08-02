/** Coach query + review-mutation hooks (§6.1). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as coachesApi from "@/api/coaches";
import type { CoachSummary } from "@/api/types";
import type { CoachCardData } from "@/components/cards";
import { formatSessionRange } from "@/lib/format";

import { keys } from "./keys";

export function useCoaches(filters: { sport?: string; q?: string }) {
  return useQuery({
    queryKey: keys.coaches.list(filters),
    queryFn: () => coachesApi.list(filters),
    staleTime: 60_000,
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
