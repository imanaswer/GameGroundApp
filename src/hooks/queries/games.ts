/**
 * Games query hooks (§6.1). Screens compose these; they never call the api layer directly.
 * staleTime: 60s lists, 30s details (§6.1).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as gamesApi from "@/api/games";
import * as venuesApi from "@/api/venues";
import type { GameDetail, GameSummary, HostPaymentStatus, PlayerRef } from "@/api/types";
import type { GameCardData, UpNextData } from "@/components/cards";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice, formatWhen } from "@/lib/format";

import { keys, type GameFilters } from "./keys";

/**
 * `enabled` exists for `useHome`'s fallback path (hand-off C3): the composed `/home` endpoint is
 * the primary source, and this list is only fetched when that one fails. Defaults to on, so every
 * other caller is unaffected.
 */
export function useGames(filters: GameFilters, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: keys.games.list(filters),
    queryFn: () => gamesApi.list(filters),
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}

/**
 * The viewer's id resolves the game's viewer-relationship flags in the mapper (see api/games.ts).
 * It is deliberately NOT part of the query key: `logout()` clears the whole cache, so a stale
 * viewer's flags can never leak into the next session.
 */
export function useGame(id: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.games.detail(id),
    queryFn: () => gamesApi.detail(id, user?.id),
    staleTime: 30_000,
  });
}

/**
 * Approved venues for one sport. `sport` is required by the create picker and the query stays idle
 * without it — an unfiltered fetch is what listed every venue in the system regardless of the sport
 * the host had just chosen, so "no sport yet" is a state to wait in, not to fetch through.
 */
export function useVenues(sport: string | null) {
  return useQuery({
    queryKey: keys.venues.list(sport),
    queryFn: () => venuesApi.list(sport),
    enabled: !!sport,
    staleTime: 300_000,
  });
}

export function useVenueSlots(venueId: string | null) {
  return useQuery({
    queryKey: keys.venues.slots(venueId ?? "none"),
    queryFn: () => venuesApi.slots(venueId as string),
    enabled: !!venueId,
    staleTime: 60_000,
  });
}

/**
 * Game action mutation (join/leave/waitlist) — NEVER an optimistic join (§6.1).
 *
 * The server answers with an action receipt (`{joined, slotsLeft, status}` / `{waitlisted,
 * position}` / `{left}`), not the game. Writing that into the detail cache blanked the screen —
 * no title, no venue, zero slots. So invalidate and let the detail query refetch the real truth.
 * `keys.games.all` is a prefix of `games.detail(id)`, so one invalidation covers both.
 */
export function useGameAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: gamesApi.GameAction) => gamesApi.act(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.games.all });
      qc.invalidateQueries({ queryKey: keys.me });
      // Join/leave/waitlist changes the viewer's own Upcoming list + Recent Activity feed on the
      // profile (["users", "profile"|"activity", id]) — refresh those so the profile stays live.
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Mark a host-collected fee as paid or pending (§9A).
 *
 * **Deliberately not optimistic**, unlike the join/leave flags this screen otherwise flips
 * eagerly. §6.1 reserves optimism for state the app can predict; this is a claim about money that
 * moved outside the app entirely, and a row that flicks to "paid" before the server agrees invents
 * a settlement record neither party made. It waits, then refetches the game.
 */
export function useMarkGamePayment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    /**
     * `userId` is per-call, not per-hook: the host's roster marks a different player on every row
     * and one mutation instance serves them all. Omitting it means "me", which is what the player's
     * own panel sends — the server defaults the target to the session user and 403s a player who
     * names anyone else.
     */
    mutationFn: (vars: { status: HostPaymentStatus; userId?: string }) =>
      gamesApi.markPayment(id, vars.status, vars.userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.games.detail(id) });
      // The composed home feed carries `myPaymentStatus` on the viewer's upcoming games.
      qc.invalidateQueries({ queryKey: keys.home });
    },
  });
}

/**
 * Organizer cancels their own game. Invalidates the lists (it disappears from the public feed),
 * the host's profile Upcoming, and the venue slots — cancelling frees the slot for rebooking.
 */
export function useCancelGame(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gamesApi.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.games.all });
      qc.invalidateQueries({ queryKey: keys.venues.all });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Host closes out a game with its attendance. One-shot and irreversible, so callers must confirm
 * first. Invalidates broadly: completing moves the game out of the open feed and the recorded
 * attendance feeds the profile/activity surfaces once an admin finalizes it.
 */
export function useCompleteGame(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attendance: gamesApi.AttendanceMap) => gamesApi.complete(id, attendance),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.games.all });
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (payload: gamesApi.CreateGamePayload) => gamesApi.create(payload, user?.id),
    onSuccess: (game: GameDetail) => {
      qc.setQueryData(keys.games.detail(game.id), game);
      qc.invalidateQueries({ queryKey: keys.games.all });
      // A newly hosted game must appear in the host's Upcoming list immediately.
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

/**
 * Real joinee avatars for a game's card. The `/games` list route sends only a joined COUNT, not
 * player identities — pass the detail route's `players` (via useGamePlayers) to show real faces.
 * Falls back to whatever players the summary itself carries (usually none on the list).
 */
export function toGameCard(g: GameSummary, players?: PlayerRef[]): GameCardData {
  const people = players ?? g.players ?? [];
  // "Filling fast" = almost full: 3 or fewer open slots left (but not already full).
  const left = g.slotsTotal - g.slotsFilled;
  const filling = left > 0 && left <= 3;
  return {
    id: g.id,
    title: g.title,
    sport: g.sport,
    venue: g.venueName,
    when: formatWhen(g.startsAt),
    price: formatPrice(g.pricePaise),
    imageUrl: g.imageUrl,
    fillingFast: filling && g.status === "open",
    players: people.map((p) => ({ name: p.name, uri: p.avatarUrl })),
    organizerTier: g.organizerTier ?? undefined,
    joined: g.slotsFilled,
    total: g.slotsTotal,
  };
}

/**
 * Joinee list for a card. Real player identities live on the detail route, so this shares the
 * detail cache (same query key) and only runs when someone has actually joined — no wasted
 * requests for empty games, and it warms the detail screen for free.
 */
export function useGamePlayers(id: string, enabled: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: keys.games.detail(id),
    queryFn: () => gamesApi.detail(id, user?.id),
    enabled,
    staleTime: 30_000,
    select: (d) => d.players,
  });
}

/** Home flagship (§6 UpNextHeroCard). Time-of-day label + raw ISO for the live countdown. */
export function toUpNext(g: GameSummary, players?: PlayerRef[]): UpNextData {
  return {
    id: g.id,
    title: g.title,
    venue: g.venueName,
    timeLabel: new Date(g.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    startsAt: g.startsAt,
    imageUrl: g.imageUrl,
    // Same as toGameCard: the list route carries no identities, so accept them from the detail query.
    players: (players ?? g.players ?? []).map((p) => ({ name: p.name, uri: p.avatarUrl })),
    joined: g.slotsFilled,
    total: g.slotsTotal,
  };
}
