/**
 * The checkout state machine (Developer PRD §9.1/§9.2/§9.4), as a pure dependency-injected
 * driver so every failure-matrix row and the reconciliation resume are unit-testable without
 * React, a real gateway, or the network. useCheckout wires the real deps to this.
 */
import { ApiClientError, isNoResponse } from "@/api/client";
import type { CreatedOrder, PaymentStatus, RazorpayResult } from "@/api/types";
import { RazorpayCancelledError } from "@/lib/razorpay";

export type CheckoutPhase = "creating" | "gateway" | "verifying";

export type Outcome =
  | { kind: "success" } //            verify 200
  | { kind: "already" } //            verify 409 (P2002) — success-equivalent (§9.2)
  | { kind: "cancelled" } //          user closed the sheet — intentional, no error (§9.2)
  | { kind: "failure"; message: string } // gateway error OR hard verify 4xx binding/signature
  | { kind: "reconcile"; orderId: string }; // debit ok, no verify verdict — go to §9.4

export type CheckoutDeps = {
  createOrder: () => Promise<CreatedOrder>;
  openGateway: (order: CreatedOrder) => Promise<RazorpayResult>;
  verify: (result: RazorpayResult, order: CreatedOrder) => Promise<void>;
};

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Payment failed";
}

/**
 * One checkout attempt. Emits phases for the VerificationTimeline and returns a terminal
 * Outcome. Never throws — every branch of §9.2 maps to a specific Outcome kind.
 */
export async function runCheckout(
  deps: CheckoutDeps,
  onPhase: (phase: CheckoutPhase) => void,
): Promise<Outcome> {
  onPhase("creating");
  let order: CreatedOrder;
  try {
    order = await deps.createOrder();
  } catch (e) {
    return { kind: "failure", message: messageOf(e) };
  }

  onPhase("gateway");
  let result: RazorpayResult;
  try {
    result = await deps.openGateway(order);
  } catch (e) {
    if (e instanceof RazorpayCancelledError) return { kind: "cancelled" };
    return { kind: "failure", message: messageOf(e) };
  }

  onPhase("verifying");
  try {
    await deps.verify(result, order);
    return { kind: "success" };
  } catch (e) {
    // 409 duplicate → already registered, no duplicate charge (§9.2 row 3).
    if (e instanceof ApiClientError && e.status === 409) return { kind: "already" };
    // Timeout / network drop AFTER a possible debit → reconcile, never "failed" (§9.2 row 5).
    if (isNoResponse(e)) return { kind: "reconcile", orderId: order.orderId };
    // 4xx binding/signature → hard failure (§9.2 row 4).
    return { kind: "failure", message: messageOf(e) };
  }
}

export type ReconcileResult = "confirmed" | "failed" | "unresolved";

/**
 * §9.4 — poll payments history for a pending order until the webhook settles it or the
 * 5-minute cap elapses. `sleep` and `fetchStatus` are injected for deterministic tests.
 */
export async function reconcile(
  orderId: string,
  fetchStatus: (orderId: string) => Promise<PaymentStatus | null>,
  opts: { intervalMs?: number; capMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ReconcileResult> {
  const intervalMs = opts.intervalMs ?? 10_000;
  const capMs = opts.capMs ?? 300_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const attempts = Math.max(1, Math.floor(capMs / intervalMs));

  for (let i = 0; i < attempts; i++) {
    let status: PaymentStatus | null = null;
    try {
      status = await fetchStatus(orderId);
    } catch {
      // A failed poll is not a verdict — keep trying until the cap.
    }
    if (status === "paid") return "confirmed";
    if (status === "failed") return "failed";
    if (i < attempts - 1) await sleep(intervalMs);
  }
  return "unresolved";
}
