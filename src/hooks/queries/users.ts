/** Profile query + edit/delete hooks (§6.1). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as paymentsApi from "@/api/payments";
import * as usersApi from "@/api/users";
import type { UpdateProfileInput, UserProfile } from "@/api/types";

import { keys } from "./keys";

export function useProfile(id: string) {
  return useQuery({
    queryKey: ["users", "profile", id],
    queryFn: () => usersApi.profile(id),
    staleTime: 30_000,
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ["users", "activity", id],
    queryFn: () => usersApi.activity(id),
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
    mutationFn: (input: UpdateProfileInput) => usersApi.update(input),
    onSuccess: (fresh: UserProfile) => {
      qc.setQueryData(["users", "profile", id], fresh);
      qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: usersApi.deleteAccount });
}
