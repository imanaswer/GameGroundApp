/**
 * useCheckout(entityType, entityId, registration) — the §9.1 flow wired to React.
 * The state transitions live in lib/checkout-machine.ts (unit-tested); this hook binds
 * them to the CheckoutSheet, query invalidation, reconciliation persistence, and FLAG_SECURE.
 *
 * The gateway open (lib/razorpay.tsx) is a real hosted-checkout WebView, not a stub —
 * DECISIONS.md #10 was ratified. It still needs a physical-device pass, which is an exit
 * criterion for any payment integration rather than a gap in this one.
 *
 * NOTE: paid entities only. A ₹0 entity can never reach here — the server's charge helpers
 * reject a zero amount, so free camps/workshops/events use their own register endpoint
 * (features/registration). Routing free through checkout silently fails.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from "expo-screen-capture";

import * as paymentsApi from "@/api/payments";
import type { EntityType } from "@/api/types";
import { useAuth } from "@/hooks/useAuth";
import { keys } from "@/hooks/queries";
import { captureException } from "@/lib/sentry";
import * as storage from "@/lib/storage";
import { openCheckout } from "@/lib/razorpay";
import { reconcile, runCheckout, type CheckoutPhase } from "@/lib/checkout-machine";

/** CheckoutSheet-facing state (M3 visual states + reconciling). */
export type CheckoutSheetState =
  | "methods"
  | "processing"
  | "success"
  | "failure"
  | "reconciling"
  | "unresolved";

export function useCheckout(
  entityType: EntityType,
  entityId: string,
  registration: Record<string, unknown> = {},
) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [state, setState] = useState<CheckoutSheetState>("methods");
  const [phase, setPhase] = useState<CheckoutPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  // FLAG_SECURE while the sheet is active in a paying state (§9.5 / S1.6).
  const secure = state === "methods" || state === "processing";
  useEffect(() => {
    if (secure) preventScreenCaptureAsync().catch(() => {});
    return () => void allowScreenCaptureAsync().catch(() => {});
  }, [secure]);

  const settleSuccess = useCallback(async () => {
    await storage.remove("gg.pendingOrder");
    // Narrow invalidation (§6.1): the entity detail, its list, me, and payments history.
    queryClient.invalidateQueries({ queryKey: keys.games.detail(entityId) });
    queryClient.invalidateQueries({ queryKey: keys.games.all });
    queryClient.invalidateQueries({ queryKey: keys.me });
    if (mounted.current) setState("success");
  }, [entityId, queryClient]);

  const beginReconcile = useCallback(
    async (orderId: string) => {
      await storage.set("gg.pendingOrder", {
        orderId,
        entityType,
        entityId,
        startedAt: Date.now(),
      });
      if (mounted.current) setState("reconciling");
      const result = await reconcile(orderId, async (id) => {
        const rows = await paymentsApi.history();
        return rows.find((r) => r.orderId === id)?.status ?? null;
      });
      if (result === "confirmed") return settleSuccess();
      if (!mounted.current) return;
      // "failed" or "unresolved" both leave the money question open for the user → support path.
      setState(result === "failed" ? "failure" : "unresolved");
      if (result === "failed") await storage.remove("gg.pendingOrder");
    },
    [entityType, entityId, settleSuccess],
  );

  const start = useCallback(async () => {
    setError(null);
    setState("processing");
    const outcome = await runCheckout(
      {
        createOrder: () => paymentsApi.createOrder(entityType, entityId),
        openGateway: (order) =>
          openCheckout(order, { email: user?.email, contact: undefined }),
        verify: (result, order) =>
          paymentsApi
            .verify({ result, entityType, entityId, registration })
            .then(() => void order),
      },
      (p) => mounted.current && setPhase(p),
    );

    if (!mounted.current) return;
    switch (outcome.kind) {
      case "success":
      case "already": // 409 = already registered, no duplicate charge — same happy end (§9.2)
        return settleSuccess();
      case "cancelled":
        return setState("methods"); // intentional exit, no error toast
      case "reconcile":
        return beginReconcile(outcome.orderId);
      case "failure":
        setError(outcome.message);
        captureException(new Error(`checkout failed: ${outcome.message}`), { entityType, entityId });
        return setState("failure");
    }
  }, [entityType, entityId, registration, user, settleSuccess, beginReconcile]);

  const reset = useCallback(() => {
    setError(null);
    setPhase(null);
    setState("methods");
  }, []);

  return { state, phase, error, start, retry: start, reset };
}

/** How long a debited-but-unconfirmed order stays worth re-polling before we stop retrying. */
const RESUME_GIVE_UP_MS = 24 * 60 * 60 * 1000;

export type PendingOrder = {
  orderId: string;
  entityType: string;
  entityId: string;
  startedAt?: number;
};

/**
 * Cold-start resume (§9.4): if a pending order was persisted, restart its poll.
 * Called once from the app shell after auth restore (see PendingPaymentBridge in app/_layout).
 *
 * Bounded on purpose: one poll runs 5 minutes at 10s intervals, so an order the webhook never
 * settles would cost 30 requests on every launch, forever. After RESUME_GIVE_UP_MS we drop the
 * record — the money question then belongs to support, not to an infinite background poll.
 *
 * Resolves with the outcome so the caller can invalidate the right entity and tell the user.
 */
export async function resumePendingReconciliation(
  onConfirmed: (pending: PendingOrder) => void,
): Promise<"confirmed" | "failed" | "unresolved" | "gave-up" | "none"> {
  const pending = await storage.get("gg.pendingOrder");
  if (!pending) return "none";

  // Entries written before `startedAt` existed: stamp now so they age out from this launch.
  if (pending.startedAt === undefined) {
    await storage.set("gg.pendingOrder", { ...pending, startedAt: Date.now() });
  } else if (Date.now() - pending.startedAt > RESUME_GIVE_UP_MS) {
    await storage.remove("gg.pendingOrder");
    return "gave-up";
  }

  const result = await reconcile(pending.orderId, async (id) => {
    const rows = await paymentsApi.history();
    return rows.find((r) => r.orderId === id)?.status ?? null;
  });

  if (result === "confirmed") {
    await storage.remove("gg.pendingOrder");
    onConfirmed(pending);
  } else if (result === "failed") {
    await storage.remove("gg.pendingOrder");
  }
  // "unresolved" deliberately keeps the record — the next cold start tries again until give-up.
  return result;
}
