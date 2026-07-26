/**
 * Games query hooks (§6.1). Screens compose these; they never call the api layer directly.
 * staleTime: 60s lists, 30s details (§6.1).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as gamesApi from "@/api/games";
import * as venuesApi from "@/api/venues";
import type { GameDetail, GameSummary } from "@/api/types";
import type { GameCardData } from "@/components/cards";
import { formatPrice, formatWhen } from "@/lib/format";

import { keys, type GameFilters } from "./keys";

export function useGames(filters: GameFilters) {
  return useQuery({
    queryKey: keys.games.list(filters),
    queryFn: () => gamesApi.list(filters),
    staleTime: 60_000,
  });
}

export function useGame(id: string) {
  return useQuery({
    queryKey: keys.games.detail(id),
    queryFn: () => gamesApi.detail(id),
    staleTime: 30_000,
  });
}

export function useVenues() {
  return useQuery({ queryKey: keys.venues.all, queryFn: venuesApi.list, staleTime: 300_000 });
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
 * Game action mutation (join/leave/waitlist). Writes the server's returned truth straight
 * into the detail cache and invalidates the lists + me — NEVER an optimistic join (§6.1).
 */
export function useGameAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: gamesApi.GameAction) => gamesApi.act(id, action),
    onSuccess: (fresh: GameDetail) => {
      qc.setQueryData(keys.games.detail(id), fresh);
      qc.invalidateQueries({ queryKey: keys.games.all });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useCreateGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: gamesApi.create,
    onSuccess: (game: GameDetail) => {
      qc.setQueryData(keys.games.detail(game.id), game);
      qc.invalidateQueries({ queryKey: keys.games.all });
    },
  });
}

/** Maps a server GameSummary → the GameCard view model (§7 GG_DATA reference shape). */
export function toGameCard(g: GameSummary): GameCardData {
  const filling = g.slotsTotal > 0 && g.slotsFilled / g.slotsTotal >= 0.75;
  return {
    id: g.id,
    title: g.title,
    venue: g.venueName,
    when: formatWhen(g.startsAt),
    price: formatPrice(g.pricePaise),
    imageUrl: g.imageUrl,
    fillingFast: filling && g.status === "open",
    players: g.players.map((p) => ({ name: p.name, uri: p.avatarUrl })),
    organizerTier: g.organizerTier ?? undefined,
    joined: g.slotsFilled,
    total: g.slotsTotal,
  };
}
