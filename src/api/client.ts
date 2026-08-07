/**
 * The ONLY fetch site in the app (lint-enforced). Developer PRD §4.1:
 * envelope unwrap, headers, 401→single-flight refresh→replay, 426 route, 429 surface, timeouts.
 */
import Constants from "expo-constants";

import { env } from "@/lib/env";
import * as storage from "@/lib/storage";

import type { RefreshPayload } from "./types";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    /** 422 flattened field errors — map to inline form errors. */
    public details?: Record<string, unknown>,
    /** Seconds until a 429 lifts, when the server said. */
    public retryAfterSec?: number,
    /** Distinguishes "no response" failures — payments reconciliation (§9.4) keys off this. */
    public code?: "timeout" | "network",
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** True when the request died without a server verdict — never treat as a definitive failure. */
export function isNoResponse(e: unknown): boolean {
  return e instanceof ApiClientError && e.code !== undefined;
}

type Handlers = {
  /** Refresh definitively rejected → tokens already cleared; route to login. */
  onSessionExpired?: () => void;
  /** HTTP 426 → route to the blocking upgrade screen. */
  onUpgradeRequired?: () => void;
};

let handlers: Handlers = {};
export function setClientHandlers(h: Handlers) {
  handlers = h;
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; details?: Record<string, unknown> };

type Options = {
  body?: unknown;
  timeoutMs?: number;
  /**
   * Don't try to refresh the session when this request 401s. Two legitimate uses, and no others:
   *
   *  1. **The credential endpoints** — login, register, refresh, revoke, forgot-password, the
   *     social exchange. A 401 there is the server rejecting the credentials themselves;
   *     refreshing and replaying would be nonsense.
   *  2. **Logout-time cleanup** (`push.unregister`). Refreshing a session that is being destroyed
   *     is wasted work, and a refresh that fails mid-logout fires "Session expired" over a logout
   *     the user asked for.
   *
   * Everywhere else a 401 means the access token expired, and the client refreshes once and
   * replays. **That includes mutations**, which does not contradict §S1.7's "mutations are never
   * auto-retried": that rule is about 429s and dropped connections, where the first attempt may
   * well have been applied and a blind retry could duplicate it. A 401 is the opposite case — the
   * server rejects it in `getSessionFromRequest` before the route handler runs, so the first
   * attempt provably did nothing and the replay is the first real attempt.
   *
   * This was one `retry401` flag, and the name did the damage: reading "retry" next to "never
   * auto-retry a mutation", every write in the app had turned it off. Reads silently recovered
   * from an expired session while writes returned a bare "Authentication required" with the app
   * still believing it was signed in — and a 401 on `/payments/verify` became a hard failure
   * instead of a reconcile, losing the recovery path for a payment that had already been debited.
   */
  skipSessionRefresh?: boolean;
  /** Internal. Set on the single replay after a refresh so a second 401 cannot recurse. */
  replayed?: boolean;
};

const DEFAULT_TIMEOUT = 15_000;

async function rawRequest<T>(method: string, path: string, opts: Options): Promise<T> {
  const token = await storage.get("gg.access");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);

  let res: Response;
  try {
    res = await fetch(`${env.apiUrl}/api${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Client": "mobile",
        "X-App-Version": Constants.expoConfig?.version ?? "0.0.0",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    throw new ApiClientError(
      0,
      timedOut ? "Request timed out" : "No connection — check your network",
      undefined,
      undefined,
      timedOut ? "timeout" : "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 426) {
    handlers.onUpgradeRequired?.();
    throw new ApiClientError(426, "Update required to continue");
  }

  // The `path` check is redundant with `skipSessionRefresh` (doRefresh sets it) and kept anyway:
  // if that flag were ever dropped from the refresh call, this is what stops the recursion.
  if (
    res.status === 401 &&
    token &&
    !opts.skipSessionRefresh &&
    !opts.replayed &&
    path !== "/auth/refresh"
  ) {
    const outcome = await refreshSession();
    if (outcome === "ok") return rawRequest<T>(method, path, { ...opts, replayed: true });
    if (outcome === "rejected") {
      await storage.clearAuth();
      handlers.onSessionExpired?.();
    } else {
      // No verdict from the refresh endpoint — report as a network failure, not a definitive 401.
      throw new ApiClientError(0, "No connection — check your network", undefined, undefined, "network");
    }
  }

  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (json?.ok === true) return json.data;

  const retryAfterRaw = res.headers.get("Retry-After");
  const retryAfterSec = retryAfterRaw ? Number(retryAfterRaw) || undefined : undefined;
  if (json?.ok === false) {
    throw new ApiClientError(res.status, json.error, json.details, retryAfterSec);
  }

  // No envelope. Every route answers `{ ok:false, error }` on failure — including genuine
  // not-founds like a deleted game — so reaching here means the response did not come from a route
  // at all: an HTML 404 from a path that isn't deployed, a proxy error, a gateway timeout. The
  // status is diagnostic, not something to read to a player, and it stays on the error object for
  // Sentry and for the dev log below.
  if (__DEV__) {
    console.warn(`[api] ${method} ${path} → HTTP ${res.status} with no error envelope`);
  }
  throw new ApiClientError(res.status, unroutedMessage(res.status), undefined, retryAfterSec);
}

/**
 * User-facing text for a response that carried no envelope. Deliberately says what the player can
 * do rather than what the server did — "HTTP 404" told them nothing and looked broken, which is
 * exactly what a beta tester hitting an undeployed endpoint would report as a bug in the app.
 */
function unroutedMessage(status: number): string {
  if (status === 404) return "This isn’t available right now. Please try again shortly.";
  if (status === 408 || status === 504) return "That took too long. Please try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "Something went wrong. Please try again.";
}

/**
 * Single-flight refresh mutex (§4.1.2): concurrent 401s share one in-flight refresh.
 * "rejected" = the server said no (expired/reused → family revoked); "unreachable" = no verdict.
 */
let refreshInFlight: Promise<"ok" | "rejected" | "unreachable"> | null = null;

export function refreshSession(): Promise<"ok" | "rejected" | "unreachable"> {
  refreshInFlight ??= doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<"ok" | "rejected" | "unreachable"> {
  const refreshToken = await storage.get("gg.refresh");
  if (!refreshToken) return "rejected";
  try {
    const data = await rawRequest<RefreshPayload>("POST", "/auth/refresh", {
      body: { refreshToken, deviceId: await storage.deviceId() },
      skipSessionRefresh: true,
    });
    await storage.set("gg.access", data.token);
    await storage.set("gg.refresh", data.refreshToken);
    return "ok";
  } catch (e) {
    return isNoResponse(e) ? "unreachable" : "rejected";
  }
}

/**
 * 429 on idempotent GETs: retry twice with exponential backoff + jitter, honoring Retry-After.
 * Mutations are NEVER auto-retried (§S1.7 — auth and payment verify above all).
 */
async function getWithBackoff<T>(path: string, opts: Options): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rawRequest<T>("GET", path, opts);
    } catch (e) {
      if (!(e instanceof ApiClientError) || e.status !== 429 || attempt >= 2) throw e;
      const base = e.retryAfterSec ? e.retryAfterSec * 1000 : 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, base + Math.random() * 400));
    }
  }
}

export const api = {
  get: <T>(path: string, opts: Options = {}) => getWithBackoff<T>(path, opts),
  post: <T>(path: string, body?: unknown, opts: Options = {}) =>
    rawRequest<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts: Options = {}) =>
    rawRequest<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts: Options = {}) =>
    rawRequest<T>("PATCH", path, { ...opts, body }),
  del: <T>(path: string, opts: Options = {}) => rawRequest<T>("DELETE", path, opts),
};
