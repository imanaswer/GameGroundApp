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
   * Attempt refresh+replay on 401. Defaults on; auth endpoints (login/register/refresh/revoke)
   * turn it off — a 401 there means bad credentials, not an expired session (§S1.7).
   */
  retry401?: boolean;
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

  if (res.status === 401 && token && opts.retry401 !== false && path !== "/auth/refresh") {
    const outcome = await refreshSession();
    if (outcome === "ok") return rawRequest<T>(method, path, { ...opts, retry401: false });
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
  const message =
    json?.ok === false ? json.error : `Something went wrong (HTTP ${res.status})`;
  throw new ApiClientError(
    res.status,
    message,
    json?.ok === false ? json.details : undefined,
    retryAfterSec,
  );
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
      retry401: false,
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
