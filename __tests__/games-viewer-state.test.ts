/**
 * Viewer-relationship derivation for game detail (audit #3).
 *
 * The live `/games/:id` route sends no viewerJoined/viewerIsOrganizer flags — only the raw facts
 * (organizerId, players[].userId). These lock in the mapper's derivation, because getting it wrong
 * makes "Leave game" unreachable and hides the organizer's attendance panel.
 */
import * as gamesApi from "@/api/games";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
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

const ORGANIZER = "user-organizer";
const PLAYER = "user-player";
const STRANGER = "user-stranger";

/** Shaped from the real production payload for /api/games/:id. */
function rawGame(over: Record<string, unknown> = {}) {
  return {
    id: "game-1",
    title: "Sunday 7s Football",
    sport: "Football",
    location: "Forza Turf",
    scheduledAt: "2026-08-01T18:30:00.000Z",
    status: "open",
    costAmount: 0,
    imageUrl: null,
    slots: 12,
    slotsLeft: 10,
    organizerId: ORGANIZER,
    organizer: { name: "Sarang S", reliabilityScore: 5, gamesOrganized: 3 },
    players: [
      // `id` is the participation record; `userId` is the actual player.
      { id: "participation-1", userId: PLAYER, name: "Stan", avatarUrl: null },
    ],
    ...over,
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

describe("game detail viewer state", () => {
  it("marks the organizer as organizer, not joined", async () => {
    mockFetchOnce(rawGame());
    const game = await gamesApi.detail("game-1", ORGANIZER);
    expect(game.viewerIsOrganizer).toBe(true);
    expect(game.viewerJoined).toBe(false);
  });

  it("marks a player in the roster as joined", async () => {
    mockFetchOnce(rawGame());
    const game = await gamesApi.detail("game-1", PLAYER);
    expect(game.viewerJoined).toBe(true);
    expect(game.viewerIsOrganizer).toBe(false);
  });

  it("leaves a stranger with no relationship", async () => {
    mockFetchOnce(rawGame());
    const game = await gamesApi.detail("game-1", STRANGER);
    expect(game.viewerJoined).toBe(false);
    expect(game.viewerIsOrganizer).toBe(false);
  });

  it("derives nothing when signed out", async () => {
    mockFetchOnce(rawGame());
    const game = await gamesApi.detail("game-1", null);
    expect(game.viewerJoined).toBe(false);
    expect(game.viewerIsOrganizer).toBe(false);
  });

  it("maps player id to the USER id, not the participation record id", async () => {
    mockFetchOnce(rawGame());
    const game = await gamesApi.detail("game-1", STRANGER);
    // Attendance and profile links key off this — the participation id would target the wrong row.
    expect(game.players[0].id).toBe(PLAYER);
  });

  it("prefers server-sent flags over derivation, so this becomes a no-op when the API ships them", async () => {
    mockFetchOnce(rawGame({ viewerJoined: true, viewerIsOrganizer: false, players: [] }));
    const game = await gamesApi.detail("game-1", ORGANIZER);
    expect(game.viewerJoined).toBe(true);
    expect(game.viewerIsOrganizer).toBe(false);
  });

  it("mirrors the server's 90-minute leave cutoff", async () => {
    // Comfortably ahead → still leavable.
    mockFetchOnce(rawGame({ scheduledAt: new Date(Date.now() + 3 * 60 * 60_000).toISOString() }));
    expect((await gamesApi.detail("game-1", PLAYER)).leaveDeadlinePassed).toBe(false);

    // Inside 90 min → blocked, matching the server's CANCEL_CUTOFF_MS 403.
    mockFetchOnce(rawGame({ scheduledAt: new Date(Date.now() + 30 * 60_000).toISOString() }));
    expect((await gamesApi.detail("game-1", PLAYER)).leaveDeadlinePassed).toBe(true);
  });
});

/**
 * The verbs are asymmetric and the server ignores any `action` field — it treats EVERY POST as a
 * join. A POSTed "leave" therefore came back 409 "already joined", so leaving never worked.
 */
describe("game actions use the right verb and never map receipts to a game", () => {
  function lastCall() {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    return { url: String(url), method: (init as { method: string }).method };
  }

  it("leaves with DELETE, not POST", async () => {
    mockFetchOnce({ left: true });
    const result = await gamesApi.act("game-1", "leave");
    expect(lastCall().method).toBe("DELETE");
    expect(result).toEqual({ kind: "left" });
  });

  it("joins with POST and no action field", async () => {
    mockFetchOnce({ joined: true, slotsLeft: 9, status: "open" });
    const result = await gamesApi.act("game-1", "join");
    const { method } = lastCall();
    expect(method).toBe("POST");
    expect(result).toEqual({ kind: "joined", slotsLeft: 9, status: "open" });
  });

  it("reports a waitlist overflow when the last slot goes mid-flight", async () => {
    mockFetchOnce({ waitlisted: true, position: 3 });
    const result = await gamesApi.act("game-1", "join");
    expect(result).toEqual({ kind: "waitlisted", position: 3 });
  });

  it("sends waitlist as the same POST — the server decides, not the client", async () => {
    mockFetchOnce({ waitlisted: true, position: 1 });
    await gamesApi.act("game-1", "waitlist");
    expect(lastCall().method).toBe("POST");
  });

  it("cancels via POST /games/:id/cancel and never auto-retries a destructive call", async () => {
    mockFetchOnce({ cancelled: true });
    await expect(gamesApi.cancel("game-1")).resolves.toEqual({ cancelled: true });
    const { url, method } = lastCall();
    expect(method).toBe("POST");
    expect(url).toContain("/games/game-1/cancel");
  });

  it("completes with a batch attendance map, not per-player calls", async () => {
    mockFetchOnce({ completed: true, pointsAwarded: false, awaitingAdminReview: true });
    const map = { "user-a": true, "user-b": false };
    await gamesApi.complete("game-1", map);

    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
    const body = JSON.parse((init as { body: string }).body);
    expect(String(url)).toContain("/games/game-1/complete");
    // One call carrying every player — /games/:id/attendance never existed.
    expect(body).toEqual({ attendance: map });
  });

  it("surfaces that completion does not award points — an admin does that later", async () => {
    mockFetchOnce({ completed: true, pointsAwarded: false, awaitingAdminReview: true });
    const r = await gamesApi.complete("game-1", { "user-a": true });
    expect(r.pointsAwarded).toBe(false);
    expect(r.awaitingAdminReview).toBe(true);
  });

  it("returns a receipt, never a GameDetail — caching the receipt blanked the screen", async () => {
    mockFetchOnce({ joined: true, slotsLeft: 9, status: "open" });
    const result = await gamesApi.act("game-1", "join");
    // The old code ran toDetail() over this and produced title:undefined, slotsTotal:0.
    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("slotsTotal");
    expect(result).not.toHaveProperty("players");
  });
});
