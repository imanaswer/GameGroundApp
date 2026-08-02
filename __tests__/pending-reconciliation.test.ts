/**
 * §9.4 cold-start resume (audit #4). If the app dies between a debit and its verify verdict, the
 * user's money is in limbo and `gg.pendingOrder` is the only record of it. These cover the resume
 * itself and the give-up bound that keeps an unsettleable order from re-polling every launch.
 */
import { resumePendingReconciliation } from "@/hooks/useCheckout";
import * as paymentsApi from "@/api/payments";
import * as storage from "@/lib/storage";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("@/api/payments", () => ({
  history: jest.fn(),
  createOrder: jest.fn(),
  verify: jest.fn(),
}));

// useCheckout pulls the gateway (react-native-webview) and useAuth (expo-notifications) into the
// module graph. The resume path touches neither — stub them so this stays a pure logic test.
jest.mock("@/lib/razorpay", () => ({ openCheckout: jest.fn() }));
jest.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@/lib/sentry", () => ({
  captureException: jest.fn(),
  breadcrumb: jest.fn(),
  setSentryUser: jest.fn(),
  initSentry: jest.fn(),
}));

jest.mock("@/lib/storage", () => {
  const mem = new Map<string, unknown>();
  return {
    __mem: mem,
    get: jest.fn(async (k: string) => mem.get(k) ?? null),
    set: jest.fn(async (k: string, v: unknown) => void mem.set(k, v)),
    remove: jest.fn(async (k: string) => void mem.delete(k)),
    clearAuth: jest.fn(async () => {}),
    deviceId: jest.fn(async () => "device-1"),
  };
});

const mem = (storage as unknown as { __mem: Map<string, unknown> }).__mem;
const history = paymentsApi.history as jest.Mock;

const ORDER = { orderId: "order-1", entityType: "game", entityId: "game-1" };
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  mem.clear();
  history.mockReset();
});

describe("resumePendingReconciliation", () => {
  it("does nothing when no order is pending", async () => {
    const onConfirmed = jest.fn();
    await expect(resumePendingReconciliation(onConfirmed)).resolves.toBe("none");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
  });

  it("confirms a settled order, clears it, and reports the entity to invalidate", async () => {
    mem.set("gg.pendingOrder", { ...ORDER, startedAt: Date.now() });
    history.mockResolvedValue([{ orderId: "order-1", status: "paid" }]);

    const onConfirmed = jest.fn();
    await expect(resumePendingReconciliation(onConfirmed)).resolves.toBe("confirmed");

    // The caller needs entityId to invalidate the thing the user actually paid for.
    expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({ entityId: "game-1" }));
    expect(mem.has("gg.pendingOrder")).toBe(false);
  });

  it("clears a definitively failed order without claiming success", async () => {
    mem.set("gg.pendingOrder", { ...ORDER, startedAt: Date.now() });
    history.mockResolvedValue([{ orderId: "order-1", status: "failed" }]);

    const onConfirmed = jest.fn();
    await expect(resumePendingReconciliation(onConfirmed)).resolves.toBe("failed");
    expect(onConfirmed).not.toHaveBeenCalled();
    expect(mem.has("gg.pendingOrder")).toBe(false);
  });

  it("gives up on an order older than 24h instead of polling forever", async () => {
    mem.set("gg.pendingOrder", { ...ORDER, startedAt: Date.now() - DAY_MS - 1000 });

    const onConfirmed = jest.fn();
    await expect(resumePendingReconciliation(onConfirmed)).resolves.toBe("gave-up");
    // The whole point: no 5-minute, 30-request poll on a dead order.
    expect(history).not.toHaveBeenCalled();
    expect(mem.has("gg.pendingOrder")).toBe(false);
  });

  it("stamps a legacy record that predates startedAt rather than dropping it", async () => {
    mem.set("gg.pendingOrder", { ...ORDER }); // no startedAt
    history.mockResolvedValue([{ orderId: "order-1", status: "paid" }]);

    await expect(resumePendingReconciliation(jest.fn())).resolves.toBe("confirmed");
    // It was stamped and then resumed normally — not treated as infinitely old.
    expect(history).toHaveBeenCalled();
  });

  it("keeps an order that is still pending so the next launch retries", async () => {
    mem.set("gg.pendingOrder", { ...ORDER, startedAt: Date.now() });
    history.mockResolvedValue([{ orderId: "order-1", status: "created" }]);

    // One poll, then stop: proves "still pending" is not mistaken for a verdict.
    const { reconcile } = jest.requireActual("@/lib/checkout-machine");
    const result = await reconcile("order-1", async () => "created", {
      intervalMs: 1,
      capMs: 2,
      sleep: async () => {},
    });
    expect(result).toBe("unresolved");
    expect(mem.has("gg.pendingOrder")).toBe(true);
  });
});
