/** Leaderboard endpoint (§3.3). okCached on the server — send only scope + window. */
import { api } from "./client";
import type { Leaderboard, LeaderScope, LeaderWindow } from "./types";

export function get(scope: LeaderScope, window: LeaderWindow): Promise<Leaderboard> {
  return api.get<Leaderboard>(`/leaderboard?scope=${scope}&window=${window}`);
}
