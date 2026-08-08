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
import { RazorpayNotConfiguredError } from "@/lib/razorpay-errors";

import { api } from "./client";
import type { CreatedOrder, EntityType, PaymentRecord, PaymentStatus, RazorpayResult } from "./types";

/**
 * The server's field vocabulary, which is NOT the app's — same split `api/games.ts` handles with
 * `toDetail`/`toSummary`, and the reason this module now has a mapping layer at all.
 *
 * `create-order` answers `{ orderId, amount, currency, keyId }` and `/payments/history` returns
 * raw Prisma `Payment` rows (`razorpayOrderId`, `amount`). Both were being cast straight to the
 * app's types, and a cast is not a conversion: `CreatedOrder.amountPaise` and
 * `PaymentRecord.orderId` were `undefined` at runtime with the compiler insisting otherwise.
 *
 * That second one was not cosmetic. §9.4 reconciliation matches a pending order by
 * `rows.find(r => r.orderId === id)`, so every comparison was `undefined === "order_x"` and the
 * poll could never find a payment — the one recovery path for money that was debited while verify
 * was interrupted. It is unreachable without live credentials, which is why nothing caught it.
 */
type RawCreatedOrder = {
  orderId?: string;
  /** Server name. */
  amount?: number;
  /** Accepted too, so a future server rename to the app's vocabulary doesn't break this. */
  amountPaise?: number;
  currency?: string;
  keyId?: string;
  /** Set only when the server has no gateway keys and minted a mock order (non-production). */
  devMode?: boolean;
};

type RawPaymentRecord = {
  /** Prisma column. */
  razorpayOrderId?: string;
  orderId?: string;
  entityType?: string;
  entityId?: string;
  amount?: number;
  amountPaise?: number;
  status?: string;
  createdAt?: string;
};

const PAYMENT_STATUSES: readonly string[] = ["created", "attempted", "paid", "failed"];

/**
 * Server-first with the app's own name as fallback — the shape the repo already uses for
 * reconciling with a server that may or may not have shipped a rename yet.
 */
function paise(raw: { amount?: number; amountPaise?: number }): number {
  if (typeof raw.amount === "number") return raw.amount;
  if (typeof raw.amountPaise === "number") return raw.amountPaise;
  return 0;
}

function toCreatedOrder(raw: RawCreatedOrder): CreatedOrder {
  // Checked before anything else: a mock order carries a placeholder key that would reach
  // checkout.js and fail as though the app were broken.
  if (raw.devMode) throw new RazorpayNotConfiguredError();
  return {
    orderId: raw.orderId ?? "",
    amountPaise: paise(raw),
    currency: raw.currency || "INR",
    keyId: raw.keyId ?? "",
  };
}

/**
 * Validated rather than cast. `entityType` is a bare String column server-side and older rows may
 * still name a game — a value deliberately absent from `EntityType` since games left the payment
 * rails — so it is narrowed here instead of being asserted into a union it may not belong to.
 */
function toPaymentRecord(raw: RawPaymentRecord): PaymentRecord {
  return {
    orderId: raw.razorpayOrderId ?? raw.orderId ?? "",
    entityType: (raw.entityType ?? "") as PaymentRecord["entityType"],
    entityId: raw.entityId ?? "",
    amountPaise: paise(raw),
    status: (PAYMENT_STATUSES.includes(raw.status ?? "") ? raw.status : "created") as PaymentStatus,
    createdAt: raw.createdAt ?? "",
  };
}

export async function createOrder(entityType: EntityType, entityId: string): Promise<CreatedOrder> {
  return toCreatedOrder(
    await api.post<RawCreatedOrder>("/payments/create-order", { entityType, entityId }),
  );
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

export async function history(): Promise<PaymentRecord[]> {
  const rows = await api.get<RawPaymentRecord[]>("/payments/history", { timeoutMs: 15_000 });
  return (Array.isArray(rows) ? rows : []).map(toPaymentRecord);
}
