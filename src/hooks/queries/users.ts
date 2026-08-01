/** Profile query + edit/delete hooks (§6.1). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as paymentsApi from "@/api/payments";
import * as usersApi from "@/api/users";
import type { UpdateProfileInput } from "@/api/types";

import { keys } from "./keys";

// `enabled` guards the empty id: callers pass `user?.id ?? ""` before the session resolves, and an
// unguarded query fired `GET /api/users/` — a 308 to a route that answers for no one.
export function useProfile(id: string) {
  return useQuery({
    queryKey: ["users", "profile", id],
    queryFn: () => usersApi.profile(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ["users", "activity", id],
    queryFn: () => usersApi.activity(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function usePaymentsHistory() {
  return useQuery({
    queryKey: ["payments", "history"],
    queryFn: paymentsApi.history,
    staleTime: 15_000,
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.update(id, input),
    // PATCH returns the raw user row (no derived stats), so refetch the full profile rather than
    // caching the stripped shape (which would blank games/stats until the next load).
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "profile", id] });
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useDeleteAccount(id: string) {
  return useMutation({ mutationFn: () => usersApi.deleteAccount(id) });
}
