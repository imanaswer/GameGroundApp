/**
 * Games query hooks (§6.1). Screens compose these; they never call the api layer directly.
 * staleTime: 60s lists, 30s details (§6.1).
 */
import { useQuery } from "@tanstack/react-query";

import * as gamesApi from "@/api/games";
import type { GameSummary } from "@/api/types";
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
