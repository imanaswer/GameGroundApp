/**
 * Push preference state for the Settings toggles (M12). Local-first via React Query so the UI
 * has a synchronous value after load; each change persists locally and mirrors to the server
 * (tolerant of the backend being undeployed — see lib/notifications.savePrefs).
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { loadPrefs, savePrefs } from "@/lib/notifications";
import { DEFAULT_PREFS, type PushCategory } from "@/lib/pushCategories";

const KEY = ["pushPrefs"] as const;

export function usePushPrefs() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: loadPrefs, staleTime: Infinity });
  const prefs = data ?? DEFAULT_PREFS;

  const setPref = (category: PushCategory, value: boolean) => {
    const next = { ...prefs, [category]: value };
    qc.setQueryData(KEY, next); // optimistic; savePrefs persists + mirrors
    savePrefs(next);
  };

  return { prefs, setPref };
}
