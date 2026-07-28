/** Auth endpoints (Developer PRD §3.2, §5). All 401s here are verdicts, not expiry — no retry. */
import * as storage from "@/lib/storage";

import { api } from "./client";
import type { AuthPayload, SessionUser } from "./types";

const NO_RETRY = { retry401: false } as const;

export async function login(email: string, password: string): Promise<AuthPayload> {
  return persist(await api.post<AuthPayload>("/auth/login", { email, password }, NO_RETRY));
}

export async function register(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return persist(await api.post<AuthPayload>("/auth/register", input, NO_RETRY));
}

/** §5.2 — native Google flow hands the verified idToken to the mobile-only route. */
export async function loginWithGoogle(idToken: string): Promise<AuthPayload> {
  return persist(await api.post<AuthPayload>("/auth/google/mobile", { idToken }, NO_RETRY));
}

/** Apple sends name/email on FIRST authorization only — forward them so the server persists. */
export async function loginWithApple(
  identityToken: string,
  fullName?: string | null,
): Promise<AuthPayload> {
  return persist(
    await api.post<AuthPayload>("/auth/apple/mobile", { identityToken, fullName }, NO_RETRY),
  );
}

/**
 * Session-validity probe on cold start (§5.1). Client handles 401→refresh→replay itself.
 * `/auth/me` returns the session nested as `{ user }` (matching the login payload); older/other
 * deployments returned it flat. Accept both so a missing top-level id/name can't blank the
 * session — an undefined `user.id` silently breaks every id-keyed screen (profile, etc.).
 */
export async function me(): Promise<SessionUser> {
  const raw = await api.get<SessionUser & { user?: SessionUser }>("/auth/me");
  return raw.user ?? raw;
}

export function forgotPassword(email: string): Promise<unknown> {
  return api.post("/auth/forgot-password", { email }, NO_RETRY);
}

/** Best-effort server revoke; callers still clear local state when this throws. */
export function revoke(all = false): Promise<unknown> {
  return storage
    .deviceId()
    .then((deviceId) => api.post("/auth/revoke", { deviceId, all }, NO_RETRY));
}

async function persist(payload: AuthPayload): Promise<AuthPayload> {
  await storage.set("gg.access", payload.token);
  await storage.set("gg.user", payload.user);
  if (payload.refreshToken) await storage.set("gg.refresh", payload.refreshToken);
  return payload;
}
