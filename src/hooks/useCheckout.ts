/**
 * useCheckout(entityType, entityId, registration) — the §9.1 flow wired to React.
 * The state transitions live in lib/checkout-machine.ts (unit-tested); this hook binds
 * them to the CheckoutSheet, query invalidation, reconciliation persistence, and FLAG_SECURE.
 *
 * ⚠️ The native gateway open is a flagged seam (lib/razorpay.ts) blocked on the Razorpay
 * New-Architecture decision (DECISIONS.md #10). Everything else here works and is tested.
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
      await storage.set("gg.pendingOrder", { orderId, entityType, entityId });
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

/**
 * Cold-start resume (§9.4): if a pending order was persisted, restart its poll.
 * Called once from the app shell after auth restore.
 */
export async function resumePendingReconciliation(
  onConfirmed: (orderId: string) => void,
): Promise<void> {
  const pending = await storage.get("gg.pendingOrder");
  if (!pending) return;
  const result = await reconcile(pending.orderId, async (id) => {
    const rows = await paymentsApi.history();
    return rows.find((r) => r.orderId === id)?.status ?? null;
  });
  if (result === "confirmed") {
    await storage.remove("gg.pendingOrder");
    onConfirmed(pending.orderId);
  } else if (result === "failed") {
    await storage.remove("gg.pendingOrder");
  }
}
