/**
 * Home data (product PRD 6.10). v1 composes the launch feed CLIENT-SIDE from endpoints that
 * already exist and work (`/games`, `/coaches`) — no fabricated backend, degrades gracefully.
 *
 * When the server `GET /api/home` ships (M9A server-half, a web-repo dependency in BACKLOG),
 * replace the body of this hook with the single authed request; every consuming component keeps
 * working because the returned shape stays the same.
 */
import type { CoachSummary, GameSummary } from "@/api/types";

import { useAuth } from "@/hooks/useAuth";

import { useCoaches } from "./coaches";
import { useGames } from "./games";
import { useProfile } from "./users";

export type HomeFeed = {
  /** The hero game: the viewer's own soonest commitment when they have one, else soonest open. */
  upNext: GameSummary | null;
  /** True when `upNext` is a game the viewer actually joined or is hosting. */
  upNextIsMine: boolean;
  /** More open games, sorted soonest-first. */
  startingSoon: GameSummary[];
  /** Coaches to learn from. */
  newCoaches: CoachSummary[];
  /** Open games starting today — drives the "N games near you tonight" greeting subtitle. */
  nearbyCount: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  isOffline: boolean;
  refetch: () => void;
};

export function useHome(): HomeFeed {
  const games = useGames({ sport: "all", status: "open" });
  const coaches = useCoaches({ sport: "all" });
  const { user } = useAuth();
  const profile = useProfile(user?.id ?? "");

  const sorted = [...(games.data ?? [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  /**
   * "Up next" reads as a personal commitment, so prefer a game the viewer is actually in. The
   * profile carries their joined/organized games; match them against the open feed so the hero
   * still gets a full GameSummary. Falls back to the soonest open game for a new user, which is
   * the right invitation — but `upNextIsMine` lets the card label it honestly.
   */
  const mineIds = new Set((profile.data?.games ?? []).map((g) => g.id));
  const mine = sorted.filter((g) => mineIds.has(g.id));
  const hero = mine[0] ?? sorted[0] ?? null;
  const upNextIsMine = !!mine[0];

  // "N games near you tonight" counts only games starting today (local date), not the whole
  // open feed — the Up Next / Starting Soon rails still surface later days.
  const now = new Date();
  const startsToday = (iso: string) => {
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
  };

  return {
    upNext: hero,
    upNextIsMine,
    // Never repeat the hero in the rail below it.
    startingSoon: sorted.filter((g) => g.id !== hero?.id).slice(0, 5),
    newCoaches: (coaches.data ?? []).slice(0, 8),
    nearbyCount: sorted.filter((g) => startsToday(g.startsAt)).length,
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
