import * as SecureStore from "expo-secure-store";

import { clearAccountData, clearAuth, deviceId, get, remove, set } from "@/lib/storage";

jest.mock("expo-crypto", () => ({ randomUUID: () => "uuid-1" }));

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
  };
});

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

test("round-trips a string value", async () => {
  await set("gg.access", "token-abc");
  expect(await get("gg.access")).toBe("token-abc");
});

test("round-trips an object value", async () => {
  const user = {
    id: "u1",
    name: "Anaswer",
    email: "a@example.com",
    username: "anaswer",
    role: "USER",
    avatarUrl: null,
  };
  await set("gg.user", user);
  expect(await get("gg.user")).toEqual(user);
});

test("returns null for a missing key", async () => {
  expect(await get("gg.refresh")).toBeNull();
});

test("drops a corrupt value instead of throwing", async () => {
  store.set("gg.access", "not-json");
  expect(await get("gg.access")).toBeNull();
  expect(store.has("gg.access")).toBe(false);
});

test("clearAuth wipes auth keys but keeps the device id", async () => {
  await set("gg.access", "a");
  await set("gg.refresh", "r");
  await set("gg.user", {
    id: "u1",
    name: "A",
    email: "a@example.com",
    username: "a",
    role: "USER",
    avatarUrl: null,
  });
  await set("gg.device", "device-1");

  await clearAuth();

  expect(await get("gg.access")).toBeNull();
  expect(await get("gg.refresh")).toBeNull();
  expect(await get("gg.user")).toBeNull();
  expect(await get("gg.device")).toBe("device-1");
});

test("deviceId generates once and is stable across calls", async () => {
  const first = await deviceId();
  const second = await deviceId();
  expect(first).toBe("uuid-1");
  expect(second).toBe(first);
});

test("remove deletes a single key", async () => {
  await set("gg.access", "a");
  await remove("gg.access");
  expect(await get("gg.access")).toBeNull();
});

/**
 * Account deletion and logout must not leave the previous person's data on the handset.
 * `clearAuth` only ever removed tokens, so everything else survived — including into a *deletion*,
 * which is the one action where a user has explicitly asked for their traces to be gone.
 */
describe("clearAccountData — the previous account's traces", () => {
  const seed = async () => {
    await set("gg.access", "tok");
    await set("gg.recentSearches", ["badminton", "kozhikode"]);
    await set("gg.lastSeenTier", "gold");
    await set("gg.pushPrefs", { gameReminders: true });
    await set("gg.setupComplete", true);
    await set("gg.setupSportsDismissed", true);
    await set("gg.pendingDeepLink", "/game/abc");
    await set("gg.pendingOrder", { orderId: "order_1", entityType: "camp", entityId: "c1" });
    await set("gg.themeMode", "dark");
    await set("gg.onboarded", true);
  };

  it("logout wipes account-scoped keys but KEEPS gg.pendingOrder", async () => {
    await seed();
    await clearAccountData({ keepPendingOrder: true });

    for (const k of ["gg.recentSearches", "gg.lastSeenTier", "gg.pushPrefs",
                     "gg.setupComplete", "gg.setupSportsDismissed", "gg.pendingDeepLink"] as const) {
      expect(await get(k)).toBeNull();
    }
    // The only handle on money debited while verify was interrupted (§9.4). Signing out
    // mid-checkout must not forfeit the recovery path.
    expect(await get("gg.pendingOrder")).not.toBeNull();
  });

  it("deletion also drops gg.pendingOrder — nothing can reconcile for a deleted account", async () => {
    await seed();
    await clearAccountData({ keepPendingOrder: false });
    expect(await get("gg.pendingOrder")).toBeNull();
  });

  it("device-scoped keys survive both — they describe the phone, not the person", async () => {
    await seed();
    const before = await deviceId();
    await clearAccountData({ keepPendingOrder: false });

    expect(await get("gg.themeMode")).toBe("dark");
    expect(await get("gg.onboarded")).toBe(true);
    // Refresh-token families are keyed on the device id (§5.3) — regenerating it would break them.
    expect(await deviceId()).toBe(before);
  });
});
