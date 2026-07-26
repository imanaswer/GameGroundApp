/** events endpoints (§3.3). Uniform with the other registerable entities — one shape. */
import { api } from "./client";
import type { RegisterableDetail, RegisterableSummary } from "./types";

export function list(params: { q?: string } = {}): Promise<RegisterableSummary[]> {
  const s = params.q ? `?q=${encodeURIComponent(params.q)}` : "";
  return api.get<RegisterableSummary[]>(`/events${s}`);
}

export function detail(id: string): Promise<RegisterableDetail> {
  return api.get<RegisterableDetail>(`/events/${id}`);
}
