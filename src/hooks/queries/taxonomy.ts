/**
 * Sport taxonomy, server-first with the local mirror as the floor (hand-off A2).
 *
 * Never returns an empty list. A picker with nothing in it is indistinguishable from a broken
 * screen, and this request has three ordinary ways to be unavailable — offline, an older
 * deployment without the route, or simply not resolved yet on first paint. In all three the
 * caller gets `SPORTS`, which is what every screen used before this endpoint shipped.
 *
 * `isServerBacked` is exposed for tests, not for screens: no UI should render differently
 * depending on where the list came from.
 */
import { useQuery } from "@tanstack/react-query";

import { getTaxonomy } from "@/api/taxonomy";
import { SPORTS } from "@/lib/sports";

import { keys } from "./keys";

export function useTaxonomy() {
  const q = useQuery({
    queryKey: keys.taxonomy,
    queryFn: getTaxonomy,
    // The server sets Cache-Control for an hour; matching it here keeps the app from asking for a
    // list that changes a few times a year on every mount.
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    // One retry, not three. The fallback is good, so a slow retry chain buys nothing a player sees.
    retry: 1,
  });

  const sports = q.data?.sports;
  return {
    sports: sports ?? [...SPORTS],
    skillLevels: q.data?.skillLevels ?? null,
    coachTypes: q.data?.coachTypes ?? null,
    eventTypes: q.data?.eventTypes ?? null,
    isServerBacked: !!sports,
  };
}
