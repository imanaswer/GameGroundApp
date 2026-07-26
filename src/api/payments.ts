/**
 * Payments endpoints (Developer PRD §9). The client sends NO amount anywhere:
 * create-order derives paise from the DB; verify re-asserts the binding server-side.
 * verify uses the 30s timeout (§4.1.5) and is NEVER auto-retried (§S1.7).
 */
import { api } from "./client";
import type { CreatedOrder, EntityType, PaymentRecord, RazorpayResult } from "./types";

export function createOrder(entityType: EntityType, entityId: string): Promise<CreatedOrder> {
  return api.post<CreatedOrder>("/payments/create-order", { entityType, entityId });
}

export function verify(input: {
  result: RazorpayResult;
  entityType: EntityType;
  entityId: string;
  /** Per-entity fields mirror the web verify Body (§9.1) — camps: child*, events: team*, etc. */
  registration: Record<string, unknown>;
}): Promise<{ registered: true }> {
  return api.post<{ registered: true }>(
    "/payments/verify",
    { ...input.result, entityType: input.entityType, entityId: input.entityId, registration: input.registration },
    { timeoutMs: 30_000, retry401: false },
  );
}

export function history(): Promise<PaymentRecord[]> {
  return api.get<PaymentRecord[]>("/payments/history", { timeoutMs: 15_000 });
}
