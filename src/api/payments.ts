/**
 * Payments endpoints (Developer PRD §9). The client sends NO amount anywhere:
 * create-order derives paise from the DB; verify re-asserts the binding server-side.
 * verify uses the 30s timeout (§4.1.5) and is never auto-retried on a 429 or a dropped connection
 * (§S1.7) — those go to the reconciliation path in checkout-machine.ts instead.
 *
 * It DOES refresh-and-replay on a 401, the one retry that is provably safe here: the server
 * rejects an expired token before the verify handler runs, so nothing was captured or registered
 * on the rejected attempt. Suppressing it turned an expired access token into a hard "payment
 * failed" on money that had already been debited — no `gg.pendingOrder` written, so neither the
 * live poll nor the cold-start resume could recover it (product PRD 6.7 AC 3). The exposure is
 * worst right after the UPI-intent hop, where the app can sit backgrounded for minutes.
 */
import { api } from "./client";
import type { CreatedOrder, EntityType, PaymentRecord, RazorpayResult } from "./types";

export function createOrder(entityType: EntityType, entityId: string): Promise<CreatedOrder> {
  return api.post<CreatedOrder>("/payments/create-order", { entityType, entityId });
}

/** The server answers `{ verified: true }` (+ `slotsLeft` for games, `bookingId` for coaches). */
export type VerifyResult = {
  verified: true;
  slotsLeft?: number;
  bookingId?: string;
};

export function verify(input: {
  result: RazorpayResult;
  entityType: EntityType;
  entityId: string;
  /** Per-entity fields mirror the web verify Body (§9.1) — camps: child*, events: team*, etc. */
  registration: Record<string, unknown>;
}): Promise<VerifyResult> {
  return api.post<VerifyResult>(
    "/payments/verify",
    { ...input.result, entityType: input.entityType, entityId: input.entityId, registration: input.registration },
    { timeoutMs: 30_000 },
  );
}

export function history(): Promise<PaymentRecord[]> {
  return api.get<PaymentRecord[]>("/payments/history", { timeoutMs: 15_000 });
}
