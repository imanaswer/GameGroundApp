/**
 * The wire shape of `/payments/*` versus the app's view types.
 *
 * These pin a class of bug the compiler cannot see: `api.get<T>()` CASTS the response, it does not
 * convert it. Both payment endpoints speak the server's vocabulary — `create-order` answers
 * `amount`, and `/payments/history` returns raw Prisma `Payment` rows (`razorpayOrderId`,
 * `amount`) — while the app's types declare `amountPaise` and `orderId`. Cast straight across,
 * those fields were `undefined` at runtime with TypeScript insisting they were numbers and strings.
 *
 * The expensive one was `orderId`. §9.4 reconciliation finds a pending order with
 * `rows.find(r => r.orderId === id)`, so every comparison was `undefined === "order_x"` and the
 * poll could never resolve a payment — the sole recovery path for money debited while verify was
 * interrupted. Unreachable without live gateway credentials, which is why it survived this long.
 */
import { createOrder, history } from "@/api/payments";
import { RazorpayNotConfiguredError } from "@/lib/razorpay-errors";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => "token-1"),
  set: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  clearAuth: jest.fn(async () => {}),
  deviceId: jest.fn(async () => "device-1"),
}));

const reply = (body: unknown) =>
  ({
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true, data: body }),
  }) as unknown as Response;

const serve = (body: unknown) => {
  global.fetch = jest.fn(async () => reply(body)) as unknown as typeof fetch;
};

describe("create-order", () => {
  /** Exactly what `GG/src/app/api/payments/create-order/route.ts` returns on the live path. */
  const WIRE = { orderId: "order_live_1", amount: 49900, currency: "INR", keyId: "rzp_live_abc" };

  test("the server's `amount` becomes the app's `amountPaise`", async () => {
    serve(WIRE);
    const order = await createOrder("coach", "c1");
    // The regression: this was `undefined`, and `undefined` is what reached checkout.js.
    expect(order.amountPaise).toBe(49900);
    expect(order.orderId).toBe("order_live_1");
    expect(order.keyId).toBe("rzp_live_abc");
  });

  test("the gateway key comes from the ORDER — the app never supplies one", async () => {
    serve({ ...WIRE, keyId: "rzp_live_rotated" });
    // Rotating the key server-side takes effect on the next order, with no app rebuild.
    await expect(createOrder("camp", "x1")).resolves.toMatchObject({ keyId: "rzp_live_rotated" });
  });

  test("a mock order is refused before the WebView can show an opaque gateway error", async () => {
    // What the server sends when it has no RAZORPAY_KEY_ID/SECRET (non-production only —
    // production fails closed with a 503 rather than inventing an order).
    serve({ orderId: "order_dev_1", amount: 49900, currency: "INR", keyId: "rzp_test_placeholder", devMode: true });
    await expect(createOrder("coach", "c1")).rejects.toBeInstanceOf(RazorpayNotConfiguredError);
  });

  test("the refusal names the SERVER credentials, not an app-side one", async () => {
    serve({ orderId: "o", amount: 1, currency: "INR", keyId: "rzp_test_placeholder", devMode: true });
    await expect(createOrder("coach", "c1")).rejects.toThrow(/RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET/);
  });

  test("currency defaults rather than arriving undefined", async () => {
    serve({ orderId: "o1", amount: 100 });
    await expect(createOrder("event", "e1")).resolves.toMatchObject({ currency: "INR" });
  });
});

describe("payments history", () => {
  /** A raw Prisma `Payment` row, which is what the route returns unmapped. */
  const ROW = {
    id: "pay_1",
    userId: "u1",
    entityType: "coach",
    entityId: "c1",
    razorpayOrderId: "order_live_1",
    razorpayPaymentId: "pay_rzp_1",
    amount: 49900,
    currency: "INR",
    status: "paid",
    createdAt: "2026-08-07T10:00:00.000Z",
  };

  test("`razorpayOrderId` becomes `orderId` — the field reconciliation matches on", async () => {
    serve([ROW]);
    const [row] = await history();
    expect(row.orderId).toBe("order_live_1");
    expect(row.amountPaise).toBe(49900);
  });

  test("the §9.4 lookup now finds its order", async () => {
    serve([ROW]);
    const rows = await history();
    // This exact expression is what useCheckout runs; it resolved to undefined before.
    expect(rows.find((r) => r.orderId === "order_live_1")?.status).toBe("paid");
  });

  test("an unknown status degrades to `created` rather than a bogus union member", async () => {
    serve([{ ...ROW, status: "captured" }]);
    const [row] = await history();
    expect(row.status).toBe("created");
  });

  test("a legacy `game` row survives — games left the rails, but old rows remain", async () => {
    // `entityType` is a bare String column server-side, so "game" can still appear in history
    // even though it is no longer a payable EntityType.
    serve([{ ...ROW, entityType: "game" }]);
    await expect(history()).resolves.toHaveLength(1);
  });

  test("a non-array body yields an empty list instead of throwing on .map", async () => {
    serve(null);
    await expect(history()).resolves.toEqual([]);
  });
});
