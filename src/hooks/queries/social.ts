/** Leaderboard + search query hooks (§6.1). */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import * as leaderboardApi from "@/api/leaderboard";
import * as searchApi from "@/api/search";
import type { LeaderScope, LeaderWindow } from "@/api/types";

export function useLeaderboard(scope: LeaderScope, window: LeaderWindow) {
  return useQuery({
    queryKey: ["leaderboard", scope, window],
    queryFn: () => leaderboardApi.get(scope, window),
    staleTime: 300_000, // 5 min (§6.1)
    // Filter changes keep the old rows on screen and animate — no full-screen spinner (§ M10).
    placeholderData: keepPreviousData,
  });
}

export function useSearch(q: string) {
  return useQuery({
    queryKey: ["search", q],
    queryFn: () => searchApi.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });
}
