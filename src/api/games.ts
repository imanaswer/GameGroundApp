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

/**
 * Join/leave/waitlist all POST /games/:id with an action (§3.3). Free join is instant;
 * the server returns the new truth — the client never marks joined optimistically (§6.1).
 */
export type GameAction = "join" | "leave" | "waitlist";

export function act(id: string, action: GameAction): Promise<GameDetail> {
  return api.post<GameDetail>(`/games/${id}`, { action });
}

export type CreateGamePayload = {
  title: string;
  sport: string;
  venueId: string;
  slotId: string;
  slotsTotal: number;
  skillLevel?: string;
  description?: string;
};

export function create(payload: CreateGamePayload): Promise<GameDetail> {
  return api.post<GameDetail>("/games", payload);
}

/** Organizer marks a player present/absent (§7). */
export function markAttendance(id: string, userId: string, present: boolean): Promise<GameDetail> {
  return api.post<GameDetail>(`/games/${id}/attendance`, { userId, present });
}
