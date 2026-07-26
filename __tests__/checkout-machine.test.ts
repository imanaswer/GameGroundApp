/**
 * M6 integration — every §9.2 failure-matrix row and the §9.4 reconciliation resume,
 * driven through the pure machine with injected deps (no gateway, no network).
 */
import { ApiClientError } from "@/api/client";
import type { CreatedOrder, PaymentStatus, RazorpayResult } from "@/api/types";
import { RazorpayCancelledError } from "@/lib/razorpay";
import { reconcile, runCheckout, type CheckoutDeps } from "@/lib/checkout-machine";

jest.mock("@/lib/env", () => ({ env: { apiUrl: "https://api.test" } }));

const ORDER: CreatedOrder = { orderId: "order_1", amountPaise: 12000, currency: "INR", keyId: "rzp_test_x" };
const RESULT: RazorpayResult = {
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: "sig_1",
};

const noResponse = () =>
  new ApiClientError(0, "No connection", undefined, undefined, "network");

function deps(over: Partial<CheckoutDeps>): CheckoutDeps {
  return {
    createOrder: async () => ORDER,
    openGateway: async () => RESULT,
    verify: async () => {},
    ...over,
  };
}

const phases: string[] = [];
const record = (p: string) => phases.push(p);
beforeEach(() => (phases.length = 0));

describe("§9.2 failure matrix", () => {
  test("happy path → success, and the timeline advances create→gateway→verify", async () => {
    const out = await runCheckout(deps({}), record);
    expect(out).toEqual({ kind: "success" });
    expect(phases).toEqual(["creating", "gateway", "verifying"]);
  });

  test("row 1 — user closes the sheet → cancelled, no error", async () => {
    const out = await runCheckout(
      deps({ openGateway: async () => { throw new RazorpayCancelledError(); } }),
      record,
    );
    expect(out).toEqual({ kind: "cancelled" });
  });

  test("row 2 — gateway failure → failure with a message", async () => {
    const out = await runCheckout(
      deps({ openGateway: async () => { throw new Error("Card declined"); } }),
      record,
    );
    expect(out).toEqual({ kind: "failure", message: "Card declined" });
  });

  test("row 3 — verify 409 duplicate → already (success-equivalent)", async () => {
    const out = await runCheckout(
      deps({ verify: async () => { throw new ApiClientError(409, "Already registered"); } }),
      record,
    );
    expect(out).toEqual({ kind: "already" });
  });

  test("row 4 — verify 4xx binding/signature → hard failure", async () => {
    const out = await runCheckout(
      deps({ verify: async () => { throw new ApiClientError(400, "Signature mismatch"); } }),
      record,
    );
    expect(out).toEqual({ kind: "failure", message: "Signature mismatch" });
  });

  test("row 5 — debit ok but verify never returns → reconcile with the orderId", async () => {
    const out = await runCheckout(
      deps({ verify: async () => { throw noResponse(); } }),
      record,
    );
    expect(out).toEqual({ kind: "reconcile", orderId: "order_1" });
  });

  test("create-order failure never reaches the gateway", async () => {
    let gatewayOpened = false;
    const out = await runCheckout(
      deps({
        createOrder: async () => { throw new ApiClientError(500, "Server error"); },
        openGateway: async () => { gatewayOpened = true; return RESULT; },
      }),
      record,
    );
    expect(out).toEqual({ kind: "failure", message: "Server error" });
    expect(gatewayOpened).toBe(false);
  });
});

describe("§9.4 reconciliation poll", () => {
  const sleep = () => Promise.resolve();

  test("webhook settles the order → confirmed", async () => {
    const statuses: (PaymentStatus | null)[] = ["created", "attempted", "paid"];
    let i = 0;
    const result = await reconcile("order_1", async () => statuses[i++], { intervalMs: 1000, capMs: 5000, sleep });
    expect(result).toBe("confirmed");
  });

  test("gateway-side failure surfaces as failed", async () => {
    const result = await reconcile("order_1", async () => "failed", { intervalMs: 1000, capMs: 5000, sleep });
    expect(result).toBe("failed");
  });

  test("never settles within the cap → unresolved (→ support path)", async () => {
    const result = await reconcile("order_1", async () => "created", { intervalMs: 1000, capMs: 3000, sleep });
    expect(result).toBe("unresolved");
  });

  test("a throwing poll is not a verdict — keeps trying until it settles", async () => {
    let call = 0;
    const result = await reconcile(
      "order_1",
      async () => {
        call++;
        if (call < 2) throw new Error("history fetch failed");
        return "paid";
      },
      { intervalMs: 1000, capMs: 5000, sleep },
    );
    expect(result).toBe("confirmed");
  });
});
