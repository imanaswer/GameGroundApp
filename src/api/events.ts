/** events endpoints (§3.3). Reconciled through the shared registerable mapper. */
import { api } from "./client";
import {
  cancelRegistration as cancelReg,
  registerFree,
  toDetail,
  toSummary,
  type RawRegisterable,
} from "./registerable";
import type { RegisterableDetail, RegisterableSummary } from "./types";

export async function list(params: { q?: string } = {}): Promise<RegisterableSummary[]> {
  const s = params.q ? `?q=${encodeURIComponent(params.q)}` : "";
  const rows = await api.get<RawRegisterable[]>(`/events${s}`);
  return rows.map((r) => toSummary(r, "event"));
}

export async function detail(id: string): Promise<RegisterableDetail> {
  return toDetail(await api.get<RawRegisterable>(`/events/${id}`), "event");
}

/** Free registration (events with price 0). Paid ones go through checkout and 402 here. */
export function register(id: string, fields: Record<string, unknown>) {
  return registerFree("events", id, fields);
}

/** Cancel this registration (90-minute pre-start cutoff, server-enforced). */
export function cancel(id: string) {
  return cancelReg("events", id);
}
