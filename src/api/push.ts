/**
 * Push registration endpoints (Developer PRD §10.1). These call the documented server
 * contract; when the routes aren't deployed yet the callers in lib/notifications.ts treat
 * failures as non-fatal (never crash). Nothing here is auto-retried at the client level —
 * the service layer owns retry policy.
 */
import { api } from "./client";
import type { PushPrefs } from "@/lib/pushCategories";

export type RegisterInput = {
  expoPushToken: string;
  platform: "ios" | "android";
  deviceId: string;
};

/** Upsert on token; refreshes lastSeenAt. Called on every app open when permission is granted. */
export function register(input: RegisterInput): Promise<{ ok: true }> {
  // Refresh-and-replay on 401 is the default; this used to say so explicitly, which is now noise.
  return api.post<{ ok: true }>("/push/register", input);
}

/**
 * Best-effort removal on logout.
 *
 * `skipSessionRefresh` is deliberate here and is the one non-credential use of it: this runs as
 * the first step of `logout()`, so renewing the session we are about to revoke is pointless, and
 * a refresh that fails would fire a "Session expired" toast over a logout the user asked for.
 */
export function unregister(expoPushToken: string): Promise<{ ok: true }> {
  return api.del<{ ok: true }>(`/push/register?token=${encodeURIComponent(expoPushToken)}`, {
    skipSessionRefresh: true,
  });
}

/** Mirror the Settings toggles to the server so pushes are gated server-side (§10.3). */
export function updatePrefs(prefs: PushPrefs): Promise<{ prefs: PushPrefs }> {
  return api.patch<{ prefs: PushPrefs }>("/push/prefs", { prefs });
}
