/**
 * Home data (product PRD 6.10), server-first since hand-off C3 shipped `GET /api/home`.
 *
 * **Primary:** one authed request that returns the whole feed already sectioned. The section rules
 * live on the server, so the app and the website can no longer disagree about what "up next" means.
 *
 * **Fallback:** the original client composition from `/games` + `/coaches`, unchanged. It runs only
 * when the composed request fails, and it is not dead code — `/home` is authed and can 401, an
 * older deployment 404s it, and Home is the launch tab. The screen that greets every player must
 * not be the one that proves the server moved.
 *
 * `HomeFeed` is deliberately identical to the pre-C3 shape: every consuming component in
 * `app/(tabs)/home.tsx` keeps working without an edit, which is what makes this swap reviewable.
 */
import { useQuery } from "@tanstack/react-query";

import { getHome } from "@/api/home";
import type { CoachSummary, GameSummary } from "@/api/types";

import { useAuth } from "@/hooks/useAuth";

import { useCoaches } from "./coaches";
import { useGames } from "./games";
import { keys } from "./keys";
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

/** Local-date "today", not a 24-hour window — "tonight" means tonight, not this time tomorrow. */
function startsToday(iso: string, now: Date): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.toDateString() === now.toDateString();
}

function bySoonest(a: GameSummary, b: GameSummary): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

export function useHome(): HomeFeed {
  const { user } = useAuth();

  const server = useQuery({
    queryKey: keys.home,
    queryFn: getHome,
    staleTime: 60_000,
    // Only for a signed-in viewer: the endpoint 401s otherwise, and a guaranteed-failing request
    // would flip the whole screen onto the fallback path on every cold start before login.
    enabled: !!user?.id,
    // One retry. A second failure means the fallback should already be fetching, not that the
    // player should keep watching a spinner.
    retry: 1,
  });

  // The fallback only fetches once the composed request has actually failed. `enabled: false`
  // leaves these queries idle — no request, no cache entry, no cost on the happy path.
  const useFallback = server.isError;
  const games = useGames({ sport: "all", status: "open" }, { enabled: useFallback });
  const coaches = useCoaches({ sport: "all" }, { enabled: useFallback });
  const profile = useProfile(useFallback ? (user?.id ?? "") : "");

  const now = new Date();

  if (!useFallback) {
    const d = server.data;
    const upcoming = [...(d?.upcoming ?? [])].sort(bySoonest);
    const open = [...(d?.openGames ?? [])].sort(bySoonest);

    // Same rule as the fallback below, now decided from the server's own sectioning: a game the
    // viewer is actually in outranks the soonest open one, and `upNextIsMine` labels it honestly.
    const hero = upcoming[0] ?? open[0] ?? null;

    return {
      upNext: hero,
      upNextIsMine: !!upcoming[0],
      // Never repeat the hero in the rail beneath it. Drawn from open games plus any further
      // commitments, so a player with two games sees the second one rather than only strangers'.
      startingSoon: [...upcoming.slice(1), ...open].filter((g) => g.id !== hero?.id).slice(0, 5),
      newCoaches: (d?.coaches ?? []).slice(0, 8),
      nearbyCount: open.filter((g) => startsToday(g.startsAt, now)).length,
      isLoading: server.isLoading,
      isError: false,
      isRefetching: server.isRefetching,
      isOffline: server.isPaused,
      refetch: () => void server.refetch(),
    };
  }

  /* ── Fallback: the pre-C3 client composition, byte-for-byte in behaviour ─────────────── */

  const sorted = [...(games.data ?? [])].sort(bySoonest);

  /**
   * "Up next" reads as a personal commitment, so prefer a game the viewer is actually in. The
   * profile carries their joined/organized games; match them against the open feed so the hero
   * still gets a full GameSummary. Falls back to the soonest open game for a new user, which is
   * the right invitation — but `upNextIsMine` lets the card label it honestly.
   */
  const mineIds = new Set((profile.data?.games ?? []).map((g) => g.id));
  const mine = sorted.filter((g) => mineIds.has(g.id));
  const hero = mine[0] ?? sorted[0] ?? null;

  return {
    upNext: hero,
    upNextIsMine: !!mine[0],
    startingSoon: sorted.filter((g) => g.id !== hero?.id).slice(0, 5),
    newCoaches: (coaches.data ?? []).slice(0, 8),
    nearbyCount: sorted.filter((g) => startsToday(g.startsAt, now)).length,
    // Loading only while we have nothing to show; an error only if BOTH sources fail.
    isLoading: (games.isLoading || coaches.isLoading) && sorted.length === 0,
    isError: games.isError && coaches.isError,
    isRefetching: games.isRefetching || coaches.isRefetching,
    isOffline: games.isPaused || coaches.isPaused,
    refetch: () => {
      // Retry the composed endpoint too — a 500 or a mid-deploy 404 is usually transient, and
      // without this the session stays on the fallback until the app is killed.
      void server.refetch();
      games.refetch();
      coaches.refetch();
    },
  };
}
