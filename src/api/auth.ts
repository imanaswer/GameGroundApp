/** Auth endpoints (Developer PRD §3.2, §5). All 401s here are verdicts, not expiry — no refresh. */
import * as storage from "@/lib/storage";

import { api } from "./client";
import type { AuthPayload, SessionUser } from "./types";

/** A 401 from these is the server rejecting the credentials — refreshing and replaying is
 *  meaningless. Every OTHER endpoint refreshes and replays; see Options in client.ts. */
const CREDENTIAL = { skipSessionRefresh: true } as const;

export async function login(email: string, password: string): Promise<AuthPayload> {
  return persist(await api.post<AuthPayload>("/auth/login", { email, password }, CREDENTIAL));
}

export async function register(input: {
  name: string;
  username: string;
  email: string;
  password: string;
}): Promise<AuthPayload> {
  return persist(await api.post<AuthPayload>("/auth/register", input, CREDENTIAL));
}

/**
 * §5.2 (scope change) — Google runs through the website's existing OAuth client in a browser tab,
 * which hands back a one-time code. `verifier` is the PKCE secret that never left this app; without
 * it the code is worthless, which is what makes the custom-scheme hop safe.
 */
export async function exchangeGoogleCode(code: string, verifier: string): Promise<AuthPayload> {
  return persist(
    await api.post<AuthPayload>("/auth/google/exchange", { code, verifier }, CREDENTIAL),
  );
}

/**
 * Sign in with Apple, native only (§5.2, Decision 29). Unlike Google there is no browser hop: the
 * OS returns a signed identity token, which the server verifies against `APPLE_BUNDLE_IDS`.
 *
 * `fullName` is forwarded because Apple releases the user's name on the **first** authorization
 * only, and only to the client — it is never inside the token, and every later sign-in omits it.
 * Pass it on or it is lost for good; the server records it on first sight. `null` afterwards is
 * expected, not a failure.
 */
export async function loginWithApple(
  identityToken: string,
  fullName?: string | null,
): Promise<AuthPayload> {
  return persist(
    await api.post<AuthPayload>("/auth/apple/mobile", { identityToken, fullName }, CREDENTIAL),
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
  return api.post("/auth/forgot-password", { email }, CREDENTIAL);
}

/** Best-effort server revoke; callers still clear local state when this throws. */
export function revoke(all = false): Promise<unknown> {
  return storage
    .deviceId()
    .then((deviceId) => api.post("/auth/revoke", { deviceId, all }, CREDENTIAL));
}

async function persist(payload: AuthPayload): Promise<AuthPayload> {
  await storage.set("gg.access", payload.token);
  await storage.set("gg.user", payload.user);
  if (payload.refreshToken) await storage.set("gg.refresh", payload.refreshToken);
  return payload;
}
