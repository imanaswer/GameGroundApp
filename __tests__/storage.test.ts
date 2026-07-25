import * as SecureStore from "expo-secure-store";

import { clearAuth, deviceId, get, remove, set } from "@/lib/storage";

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
