/**
 * Client-side mirrors of server eligibility rules (audit #5, #16, #17, #31).
 *
 * Each of these exists to stop the app offering an action the server will refuse. When one drifts
 * the symptom is identical every time: the user completes a flow and gets an error at the end.
 */
import * as coachesApi from "@/api/coaches";
import * as leaderboardApi from "@/api/leaderboard";
import * as venuesApi from "@/api/venues";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", appleAuthEnabled: false, posthogKey: "", sentryDsn: null },
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

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function mockOnce(payload: unknown) {
  fetchMock.mockResolvedValue({
    status: 200,
    headers: { get: () => null },
    json: async () => ({ ok: true, data: payload }),
  });
}

beforeEach(() => fetchMock.mockReset());

/** Mirrors the server's isInstantPayEligible: one fixed price, stored as min===max or max===0. */
describe("coach instant-pay eligibility (#31)", () => {
  const coach = (priceMin: number, priceMax: number) => ({
    id: "c1", name: "Coach", sport: "Tennis", imageUrl: null, rating: 0, reviewCount: 0,
    priceMin, priceMax,
  });

  it("allows a single price stored as max === 0", async () => {
    mockOnce(coach(3000, 0));
    expect((await coachesApi.detail("c1")).instantPayEligible).toBe(true);
  });

  it("allows a single price stored as min === max", async () => {
    mockOnce(coach(3000, 3000));
    expect((await coachesApi.detail("c1")).instantPayEligible).toBe(true);
  });

  it("refuses a genuine price range — those are request-only", async () => {
    mockOnce(coach(2000, 5000));
    expect((await coachesApi.detail("c1")).instantPayEligible).toBe(false);
  });

  it("refuses a coach with no price", async () => {
    mockOnce(coach(0, 0));
    expect((await coachesApi.detail("c1")).instantPayEligible).toBe(false);
  });
});

describe("venue slots (#16)", () => {
  it("marks a past slot unavailable — the server rejects it at create time anyway", async () => {
    const past = new Date(Date.now() - 60 * 60_000).toISOString();
    const future = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    mockOnce([
      { id: "s-past", startTime: past, endTime: past, available: true },
      { id: "s-future", startTime: future, endTime: future, available: true },
    ]);
    const slots = await venuesApi.slots("v1");
    expect(slots.find((s) => s.id === "s-past")?.available).toBe(false);
    expect(slots.find((s) => s.id === "s-future")?.available).toBe(true);
  });

  it("still honours an explicit unavailable flag on a future slot", async () => {
    const future = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
    mockOnce([{ id: "s1", startTime: future, endTime: future, available: false }]);
    expect((await venuesApi.slots("v1"))[0].available).toBe(false);
  });
});

describe("leaderboard delta (#17)", () => {
  it("is null, not 0 — the route does not compute rank movement", async () => {
    mockOnce({
      type: "players", period: "all", generatedAt: "", rows: [
        { id: "u1", name: "A", username: "a", avatarUrl: null, location: null, tier: "gold", reputationScore: 30, gamesPlayed: 1, gamesOrganized: 0, attendanceRate: 100, reliabilityScore: 5, rank: 1 },
      ],
    });
    const board = await leaderboardApi.get("players", "all");
    // 0 would render as "no movement"; null means "unknown", and the row omits the indicator.
    expect(board.rows[0].delta).toBeNull();
  });

  it("scores organizers by games organized, not reputation", async () => {
    mockOnce({
      type: "organizers", period: "all", generatedAt: "", rows: [
        { id: "u1", name: "A", username: "a", avatarUrl: null, location: null, tier: "gold", reputationScore: 999, gamesPlayed: 1, gamesOrganized: 7, attendanceRate: 100, reliabilityScore: 5, rank: 1 },
      ],
    });
    const board = await leaderboardApi.get("organizers", "all");
    expect(board.rows[0].score).toBe(7);
  });
});
