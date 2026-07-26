/**
 * Home data (product PRD 6.10). v1 composes the launch feed CLIENT-SIDE from endpoints that
 * already exist and work (`/games`, `/coaches`) — no fabricated backend, degrades gracefully.
 *
 * When the server `GET /api/home` ships (M9A server-half, a web-repo dependency in BACKLOG),
 * replace the body of this hook with the single authed request; every consuming component keeps
 * working because the returned shape stays the same.
 */
import type { CoachSummary, GameSummary } from "@/api/types";

import { useCoaches } from "./coaches";
import { useGames } from "./games";

export type HomeFeed = {
  /** Soonest open game — the "Up next tonight" feature. */
  upNext: GameSummary | null;
  /** More open games, sorted soonest-first. */
  startingSoon: GameSummary[];
  /** Coaches to learn from. */
  newCoaches: CoachSummary[];
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isOffline: boolean;
  refetch: () => void;
};

export function useHome(): HomeFeed {
  const games = useGames({ sport: "all", status: "open" });
  const coaches = useCoaches({ sport: "all" });

  const sorted = [...(games.data ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return {
    upNext: sorted[0] ?? null,
    startingSoon: sorted.slice(1, 6),
    newCoaches: (coaches.data ?? []).slice(0, 8),
    // Loading only while we have nothing to show; an error only if BOTH sources fail.
    isLoading: (games.isLoading || coaches.isLoading) && sorted.length === 0,
    isError: games.isError && coaches.isError,
    isRefetching: games.isRefetching || coaches.isRefetching,
    isOffline: games.isPaused || coaches.isPaused,
    refetch: () => {
      games.refetch();
      coaches.refetch();
    },
  };
}
