/**
 * Games endpoints (Developer PRD §3.3). Response types in api/types.ts — the single
 * place to reconcile when the web route select changes.
 */
import { api } from "./client";
import type { GameDetail, GameSummary } from "./types";

export type GameListParams = {
  q?: string;
  sport?: string;
  status?: "open" | "completed" | "all";
};

function toQuery(params: GameListParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.sport && params.sport !== "all") sp.set("sport", params.sport);
  if (params.status) sp.set("status", params.status);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function list(params: GameListParams = {}): Promise<GameSummary[]> {
  return api.get<GameSummary[]>(`/games${toQuery(params)}`);
}

export function detail(id: string): Promise<GameDetail> {
  return api.get<GameDetail>(`/games/${id}`);
}
