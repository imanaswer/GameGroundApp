/** Query hooks for registerable entities — one pair, parameterized by entity config (M9). */
import { useQuery } from "@tanstack/react-query";

import type { RegisterableSummary } from "@/api/types";
import type { RegistrationCardData } from "@/components/cards";
import { keys } from "@/hooks/queries";
import { formatPrice, formatWhen } from "@/lib/format";

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

export function toRegistrationCard(s: RegisterableSummary): RegistrationCardData {
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    when: formatWhen(s.startsAt),
    price: formatPrice(s.pricePaise),
    imageUrl: s.imageUrl,
    registered: s.registered,
    capacity: s.capacity,
  };
}
