/**
 * THE native payment seam — the ONLY place that opens the gateway checkout.
 *
 * ⚠️ BLOCKED (see docs/DECISIONS.md #10 / BACKLOG.md "Open blocker"): the pinned
 * `react-native-razorpay` does not support the New Architecture, and SDK 57 / RN 0.86
 * is bridgeless-only. Which checkout to use — Razorpay's newer official RN SDK, an
 * interop shim, or the hosted web-view — is an owner decision that must be RATIFIED in
 * DECISIONS.md before this is wired. Everything else in the checkout flow (create-order,
 * verify, the failure matrix, reconciliation) is SDK-agnostic and complete.
 *
 * Isolating the native call here means the decision changes exactly one file, and the
 * rest of M6 is testable today by mocking `openCheckout`.
 */
import type { CreatedOrder, RazorpayResult } from "@/api/types";

export type CheckoutPrefill = { email?: string; contact?: string };

/** Thrown when checkout is invoked before the SDK decision is ratified + wired. */
export class RazorpayUnavailableError extends Error {
  constructor() {
    super("Payment checkout is not available in this build yet.");
    this.name = "RazorpayUnavailableError";
  }
}

/** User dismissed the native sheet — an intentional exit, not a failure (§9.2 row 1). */
export class RazorpayCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "RazorpayCancelledError";
  }
}

/**
 * Opens the gateway and resolves with the signed result to hand to /payments/verify.
 * Amount comes from the server-issued order — the client passes it through, never computes it.
 *
 * ponytail: throws until ratified. When the decision lands, the body becomes the SDK call
 * (`RazorpayCheckout.open({ key: order.keyId, order_id: order.orderId, amount: order.amountPaise, ... })`)
 * mapping the cancel code → RazorpayCancelledError. Nothing above this line changes.
 */
export async function openCheckout(
  _order: CreatedOrder,
  _prefill: CheckoutPrefill,
): Promise<RazorpayResult> {
  throw new RazorpayUnavailableError();
}
