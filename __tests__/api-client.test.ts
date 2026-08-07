/**
 * M2 exit-criteria tests (Developer PRD §4.1, §14): envelope parsing,
 * refresh mutex (concurrent 401s → one refresh), 426/429 handling, timeouts.
 */
import { ApiClientError, api, setClientHandlers } from "@/api/client";
import * as storage from "@/lib/storage";

jest.mock("@/lib/env", () => ({
  env: { appEnv: "development", apiUrl: "https://api.test", razorpayKeyId: "", googleIosClientId: "", googleAndroidClientId: "", posthogKey: "", sentryDsn: null },
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { version: "1.0.0" } },
}));

jest.mock("@/lib/storage", () => {
  const mem = new Map<string, unknown>();
  return {
    __mem: mem,
    get: jest.fn(async (k: string) => mem.get(k) ?? null),
    set: jest.fn(async (k: string, v: unknown) => void mem.set(k, v)),
    remove: jest.fn(async (k: string) => void mem.delete(k)),
    clearAuth: jest.fn(async () => {
      mem.delete("gg.access");
      mem.delete("gg.refresh");
      mem.delete("gg.user");
    }),
    deviceId: jest.fn(async () => "device-1"),
  };
});

const mem = (storage as unknown as { __mem: Map<string, unknown> }).__mem;

const res = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  }) as unknown as Response;

const trap = (p: Promise<unknown>): Promise<ApiClientError> =>
  p.then(
    () => Promise.reject(new Error("expected rejection")),
    (e) => e as ApiClientError,
  );

const fetchMock = jest.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

beforeEach(() => {
  fetchMock.mockReset();
  mem.clear();
  setClientHandlers({});
  // Several cases here deliberately drive the no-envelope path, which warns under __DEV__ to give
  // a developer the status and route. That warning is the expected behaviour, not a failure —
  // keep it out of the suite output so a passing run doesn't read like a broken one.
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("envelope parsing", () => {
  test("unwraps ok:true and sends the contract headers", async () => {
    mem.set("gg.access", "tok-1");
    fetchMock.mockResolvedValue(res(200, { ok: true, data: { id: "g1" } }));

    const data = await api.get<{ id: string }>("/games/g1");

    expect(data).toEqual({ id: "g1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/games/g1");
    expect(init.headers).toMatchObject({
      "X-Client": "mobile",
      "X-App-Version": "1.0.0",
      Authorization: "Bearer tok-1",
    });
  });

  test("throws a typed error with 422 details for inline field mapping", async () => {
    fetchMock.mockResolvedValue(
      res(422, { ok: false, error: "Invalid input", details: { email: ["Enter a valid email"] } }),
    );

    const err = await trap(api.post("/auth/register", {}));
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(422);
    expect(err.message).toBe("Invalid input");
    expect(err.details).toEqual({ email: ["Enter a valid email"] });
  });

  /**
   * A body with no envelope did not come from a route — every route answers `{ ok:false, error }`
   * on failure, including real not-founds. So this is infrastructure: an HTML 404 from an
   * undeployed path, a proxy error, a gateway timeout. The message used to interpolate the status
   * ("Something went wrong (HTTP 404)"), which is what a player saw when an endpoint was missing —
   * it reads as a broken app and tells them nothing they can act on. The status is still on the
   * error for Sentry and for the branches that key off it.
   */
  test("non-envelope body keeps the status on the error, not in the message", async () => {
    fetchMock.mockResolvedValue(res(502, "<html>bad gateway</html>"));
    const err = await trap(api.get("/games"));
    expect(err.status).toBe(502);
    expect(err.message).not.toMatch(/502|HTTP/);
    expect(err.message).toBe("Something went wrong on our end. Please try again.");
  });

  test("an undeployed endpoint reads as unavailable, not as a crash", async () => {
    // The live case: /api/auth/google/exchange before feat/mobile-social-auth ships. Next.js
    // answers with its HTML 404 page, so there is no server message to surface.
    fetchMock.mockResolvedValue(res(404, "<html>Page not found</html>"));
    const err = await trap(api.post("/auth/google/exchange", { code: "c", verifier: "v" }));
    expect(err.status).toBe(404);
    expect(err.message).toBe("This isn’t available right now. Please try again shortly.");
  });

  test("a REAL not-found still shows the server's own wording", async () => {
    // The distinction that matters: a deleted game is a routed 404 WITH an envelope, and its
    // message is written for the player. Collapsing both into one string would have lost it.
    fetchMock.mockResolvedValue(res(404, { ok: false, error: "Game not found" }));
    const err = await trap(api.get("/games/gone"));
    expect(err.status).toBe(404);
    expect(err.message).toBe("Game not found");
  });

  test("a timeout status reads as a timeout", async () => {
    fetchMock.mockResolvedValue(res(504, "<html>gateway timeout</html>"));
    const err = await trap(api.get("/games"));
    expect(err.message).toBe("That took too long. Please try again.");
  });
});

describe("401 → refresh → replay", () => {
  const routes = (refreshStatus: number) => (url: string, init: { headers: Record<string, string> }) => {
    if (url.endsWith("/auth/refresh"))
      return Promise.resolve(
        refreshStatus === 200
          ? res(200, { ok: true, data: { token: "tok-new", refreshToken: "ref-new" } })
          : res(401, { ok: false, error: "Token reuse detected" }),
      );
    return Promise.resolve(
      init.headers.Authorization === "Bearer tok-new"
        ? res(200, { ok: true, data: { fine: true } })
        : res(401, { ok: false, error: "Unauthorized" }),
    );
  };

  test("concurrent 401s share ONE refresh and both replay successfully", async () => {
    mem.set("gg.access", "tok-stale");
    mem.set("gg.refresh", "ref-1");
    fetchMock.mockImplementation(routes(200));

    const [a, b] = await Promise.all([api.get("/games"), api.get("/coaches")]);

    expect(a).toEqual({ fine: true });
    expect(b).toEqual({ fine: true });
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
    expect(JSON.parse(refreshCalls[0][1].body)).toEqual({ refreshToken: "ref-1", deviceId: "device-1" });
    expect(mem.get("gg.access")).toBe("tok-new");
    expect(mem.get("gg.refresh")).toBe("ref-new");
  });

  test("rejected refresh (rotated-token reuse) clears tokens and signals session expiry", async () => {
    mem.set("gg.access", "tok-stale");
    mem.set("gg.refresh", "ref-replayed");
    const onSessionExpired = jest.fn();
    setClientHandlers({ onSessionExpired });
    fetchMock.mockImplementation(routes(401));

    const err = await trap(api.get("/games"));

    expect(err.status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(mem.has("gg.access")).toBe(false);
    expect(mem.has("gg.refresh")).toBe(false);
  });

  test("requests without a token never attempt refresh (bad login stays a 401)", async () => {
    fetchMock.mockResolvedValue(res(401, { ok: false, error: "Wrong password" }));
    const err = await trap(
      api.post("/auth/login", { email: "a@b.c", password: "x" }, { skipSessionRefresh: true }),
    );
    expect(err.message).toBe("Wrong password");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * The counterpart to the test above, and the regression guard for the bug this replaced: every
   * write in the app had opted out of refresh-and-replay, so an expired access token surfaced as a
   * bare "Authentication required" while reads recovered silently. The server rejects a 401 before
   * the route handler runs, so replaying a mutation is safe — and on `/payments/verify` it is the
   * difference between a recoverable payment and one reported as failed after the money moved.
   */
  test("a MUTATION also refreshes and replays, and does so exactly once", async () => {
    mem.set("gg.access", "tok-stale");
    mem.set("gg.refresh", "ref-1");
    fetchMock.mockImplementation(routes(200));

    const out = await api.post("/payments/verify", { razorpay_payment_id: "pay_1" });

    expect(out).toEqual({ fine: true });
    const verifyCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/payments/verify"));
    expect(verifyCalls).toHaveLength(2); // the 401, then the replay — never more
    expect(verifyCalls[1][1].headers.Authorization).toBe("Bearer tok-new");
  });

  test("a replay that 401s again gives up instead of looping", async () => {
    mem.set("gg.access", "tok-stale");
    mem.set("gg.refresh", "ref-1");
    // Refresh succeeds, but the replayed request is still refused. Without the `replayed` guard
    // this recurses until the stack gives out.
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        String(url).endsWith("/auth/refresh")
          ? res(200, { ok: true, data: { token: "tok-new", refreshToken: "ref-new" } })
          : res(401, { ok: false, error: "Unauthorized" }),
      ),
    );

    const err = await trap(api.del("/users/u1"));

    expect(err.status).toBe(401);
    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u).endsWith("/auth/refresh"));
    expect(refreshCalls).toHaveLength(1);
  });
});

describe("426 / 429 / timeouts", () => {
  test("426 routes to the upgrade wall and throws", async () => {
    const onUpgradeRequired = jest.fn();
    setClientHandlers({ onUpgradeRequired });
    fetchMock.mockResolvedValue(res(426, { ok: false, error: "Update required" }));

    const err = await trap(api.get("/games"));
    expect(err.status).toBe(426);
    expect(onUpgradeRequired).toHaveBeenCalledTimes(1);
  });

  test("429 on a mutation is NEVER auto-retried and surfaces Retry-After", async () => {
    fetchMock.mockResolvedValue(
      res(429, { ok: false, error: "Too many requests" }, { "Retry-After": "30" }),
    );

    const err = await trap(api.post("/auth/login", {}));
    expect(err.status).toBe(429);
    expect(err.retryAfterSec).toBe(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("429 on a GET backs off and retries to success", async () => {
    jest.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce(res(429, { ok: false, error: "Slow down" }, { "Retry-After": "1" }))
      .mockResolvedValueOnce(res(200, { ok: true, data: [1, 2] }));

    const pending = api.get("/games");
    await jest.advanceTimersByTimeAsync(2000);
    await expect(pending).resolves.toEqual([1, 2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test("network death is typed as no-response, not a failure verdict", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const err = await trap(api.post("/payments/verify", {}));
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe("network");
    expect(err.status).toBe(0);
  });

  test("abort is typed as timeout", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    const err = await trap(api.get("/games"));
    expect(err.code).toBe("timeout");
  });
});
