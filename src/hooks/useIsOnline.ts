/**
 * Connectivity signal from React Query's onlineManager (wired to NetInfo in the root layout).
 * Screens use it to show the offline banner and disable mutating controls (§8.3) — writes
 * require connectivity and must fail loudly, not silently queue (v1 non-goal).
 */
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useState } from "react";

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(() => setOnline(onlineManager.isOnline())), []);
  return online;
}
