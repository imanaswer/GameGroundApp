/** Query hooks for registerable entities — one pair, parameterized by entity config (M9). */
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import type { RegisterableSummary } from "@/api/types";
import type { RegistrationCardData } from "@/components/cards";
import { keys } from "@/hooks/queries";
import { formatDate, formatPrice, formatTimeOfDay } from "@/lib/format";

import type { EntityConfig } from "./entities";

export function useRegisterableList(config: EntityConfig, q: string) {
  return useQuery({
    queryKey: keys.registerables.list(config.kind, q),
    queryFn: () => config.list({ q: q || undefined }),
    staleTime: 60_000,
  });
}

export function useRegisterableDetail(config: EntityConfig, id: string) {
  return useQuery({
    queryKey: keys.registerables.detail(config.kind, id),
    queryFn: () => config.detail(id),
    staleTime: 30_000,
  });
}

/**
 * Free registration. Separate from checkout by necessity, not preference: the server rejects a ₹0
 * charge, so a free camp/workshop/event can only be registered through this endpoint.
 */
export function useRegisterFree(config: EntityConfig, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fields: Record<string, unknown>) => config.register(id, fields),
    onSuccess: () => invalidateRegisterable(qc, config, id),
  });
}

/** Cancel the viewer's registration. Server enforces a 90-minute pre-start cutoff. */
export function useCancelRegistration(config: EntityConfig, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => config.cancel(id),
    onSuccess: () => invalidateRegisterable(qc, config, id),
  });
}

/** Both mutations change capacity and the viewer's own registration — refresh detail, list, profile. */
function invalidateRegisterable(qc: QueryClient, config: EntityConfig, id: string) {
  qc.invalidateQueries({ queryKey: keys.registerables.detail(config.kind, id) });
  qc.invalidateQueries({ queryKey: ["registerables", config.kind, "list"] });
  qc.invalidateQueries({ queryKey: ["users"] });
}

export function toRegistrationCard(s: RegisterableSummary): RegistrationCardData {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    // Server's human date range ("Jul 20 – Aug 3") beats a midnight timestamp for multi-day events.
    when: s.dateLabel ?? formatDate(s.startsAt),
    // Second meta row (matches the games card). Null for date-only entries so no "12:00 AM" shows.
    time: formatTimeOfDay(s.startsAt) ?? undefined,
    price: formatPrice(s.pricePaise),
    imageUrl: s.imageUrl,
    registered: s.registered,
    capacity: s.capacity,
    featured: s.featured,
  };
}
