/**
 * The host's settle-up roster, at the API layer (§9A).
 *
 * The roster is what a host uses to decide who still owes them money, so the two things pinned
 * here are the two that would cost real rupees: that an unrecognised `paymentStatus` reads as
 * UNPAID rather than paid, and that a mark targets the player the host tapped rather than the
 * host themselves.
 */
import * as gamesApi from "@/api/games";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => ({
  get: jest.fn(async () => null),
  set: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
  clearAuth: jest.fn(async () => {}),
  deviceId: jest.fn(async () => "device-1"),
}));

const HOST = "user-host";
const ALICE = "user-alice";
const BOB = "user-bob";

function rawGame(players: Record<string, unknown>[]) {
  return {
    id: "game-1",
    title: "Sunday 7s",
    sport: "Football",
    location: "Forza Turf",
    scheduledAt: "2026-08-20T18:30:00.000Z",
    status: "open",
    costAmount: 120,
    imageUrl: null,
    slots: 12,
    slotsLeft: 10,
    organizerId: HOST,
    organizer: { name: "Host", reliabilityScore: 5, gamesOrganized: 3 },
    players,
  };
}

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function mockFetchOnce(payload: unknown) {
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true, data: payload }),
  });
}

beforeEach(() => fetchMock.mockReset());

describe("per-player payment status reaches the roster", () => {
  it("carries paid and pending through the mapper", async () => {
    mockFetchOnce(
      rawGame([
        { id: "p1", userId: ALICE, name: "Alice", avatarUrl: null, paymentStatus: "paid" },
        { id: "p2", userId: BOB, name: "Bob", avatarUrl: null, paymentStatus: "pending" },
      ]),
    );
    const game = await gamesApi.detail("game-1", HOST);
    expect(game.players.find((p) => p.id === ALICE)?.paymentStatus).toBe("paid");
    expect(game.players.find((p) => p.id === BOB)?.paymentStatus).toBe("pending");
  });

  it.each([undefined, null, "", "PAID", "settled", 1])(
    "treats %p as unpaid — the host keeps chasing rather than writing it off",
    async (value) => {
      mockFetchOnce(
        rawGame([{ id: "p1", userId: ALICE, name: "Alice", avatarUrl: null, paymentStatus: value }]),
      );
      const game = await gamesApi.detail("game-1", HOST);
      expect(game.players[0].paymentStatus).toBe("pending");
    },
  );

  it("keys the row by USER id, since that is what a mark has to target", async () => {
    mockFetchOnce(
      rawGame([
        { id: "participation-77", userId: ALICE, name: "Alice", avatarUrl: null, paymentStatus: "paid" },
      ]),
    );
    const game = await gamesApi.detail("game-1", HOST);
    // Marking "participation-77" would 404 — that row belongs to no user.
    expect(game.players[0].id).toBe(ALICE);
  });
});

describe("markPayment addresses the right player", () => {
  function lastRequest() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(url), body: JSON.parse(String(init.body)) as Record<string, unknown> };
  }

  it("names the player when a host marks someone else", async () => {
    mockFetchOnce({ ok: true });
    await gamesApi.markPayment("game-1", "paid", ALICE);
    const { url, body } = lastRequest();
    expect(url).toContain("/games/game-1/payment");
    expect(body).toEqual({ paymentStatus: "paid", userId: ALICE });
  });

  it("omits userId when a player marks themselves, so the server uses the session", async () => {
    mockFetchOnce({ ok: true });
    await gamesApi.markPayment("game-1", "paid");
    // Sending `userId: undefined` would serialise the key away anyway, but an explicit null or ""
    // would be read as a target — assert the key is simply absent.
    expect(lastRequest().body).toEqual({ paymentStatus: "paid" });
  });

  it("can reverse a mark, because hosts mistap", async () => {
    mockFetchOnce({ ok: true });
    await gamesApi.markPayment("game-1", "pending", BOB);
    expect(lastRequest().body).toEqual({ paymentStatus: "pending", userId: BOB });
  });
});
