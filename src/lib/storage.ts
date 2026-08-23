/**
 * The ONLY import site of expo-secure-store (Developer PRD §S1.1, lint-enforced).
 * Nothing security-relevant goes to AsyncStorage.
 *
 * On web, expo-secure-store is unavailable so we fall back to localStorage.
 * This is acceptable for web dev/preview; production web would use httpOnly cookies.
 */
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { SessionUser } from "@/api/types";

/* ── Platform-aware storage adapter ────────────────────────────────────── */

const kv = Platform.OS === "web"
  ? {
      getItemAsync: (key: string): Promise<string | null> =>
        Promise.resolve(typeof localStorage !== "undefined" ? localStorage.getItem(key) : null),
      setItemAsync: (key: string, value: string): Promise<void> => {
        if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
        return Promise.resolve();
      },
      deleteItemAsync: (key: string): Promise<void> => {
        if (typeof localStorage !== "undefined") localStorage.removeItem(key);
        return Promise.resolve();
      },
    }
  : {
      getItemAsync: SecureStore.getItemAsync,
      setItemAsync: SecureStore.setItemAsync,
      deleteItemAsync: SecureStore.deleteItemAsync,
    };

/** Keys per Developer PRD §5.2. Values are stored JSON-encoded. */
type Schema = {
  "gg.access": string;
  "gg.refresh": string;
  "gg.user": SessionUser;
  /** Stable per-install id; refresh-token families are keyed on it (§5.3). */
  "gg.device": string;
  /** Onboarding shown once (M4). Not secret, but this typed KV is our only storage seam. */
  "gg.onboarded": boolean;
  /**
   * §9.4 reconciliation — a debited-but-unconfirmed order resumed on next cold start (M6).
   * `startedAt` (epoch ms) bounds the resume: a poll runs 5 min, so without a give-up age an order
   * the webhook never settles would re-poll on every launch forever. Optional — entries written
   * before this field existed are stamped on their first resume.
   */
  "gg.pendingOrder": {
    orderId: string;
    entityType: string;
    entityId: string;
    startedAt?: number;
  };
  /** Local recent search terms (M10) — non-secret, but this KV is our only storage seam. */
  "gg.recentSearches": string[];
  /** Home: the "set your sports" nudge is dismissible-once. Non-secret; this KV is our seam. */
  "gg.setupSportsDismissed": boolean;
  /**
   * Account setup ran (Decision 23). Set on the way OUT of the flow whether the questions were
   * answered or skipped — it records that we asked, not what came back. Only the signup path
   * enters the flow, so this exists to stop a repeat, never to trigger one.
   */
  "gg.setupComplete": boolean;
  /** Appearance preference (Decision 24): "light" | "dark" | "system". Non-secret; this KV is
   *  our only storage seam, and it is read before first paint. */
  "gg.themeMode": string;
  /** Push (M12): whether the contextual pre-prompt has been shown (never re-ask on denial). */
  "gg.pushPromptSeen": boolean;
  /** Push (M12): per-category prefs, mirrored to the server; local is the offline source. */
  "gg.pushPrefs": Record<string, boolean>;
  /** Push (M12): last Expo token we registered — detects refresh + lets logout unregister. */
  "gg.pushToken": string;
  /** Deep link (M13): target path stashed while logged out, resumed after login. */
  "gg.pendingDeepLink": string;
  /** Delight (M14): last tier the user has been congratulated for — tier-up fires once. */
  "gg.lastSeenTier": string;
  /**
   * Google sign-in PKCE verifier, stashed the moment the browser hop opens (§5.2 addendum).
   * Android can kill a freshly-installed app's process while it's backgrounded for the OAuth
   * pages — no prior importance history makes it a prime low-memory-killer target. When that
   * happens, the redirect back to `ggredesign://auth-callback?code=...` cold-starts a brand new
   * process instead of resuming the one that opened the browser, and the `verifier` living in that
   * dead process's closure is gone. Persisting it here is what lets the fresh process finish the
   * exchange from its own launch URL. Cleared the instant it's consumed — success, failure, or
   * abandoned — so it never outlives the attempt that created it.
   */
  "gg.pendingGoogleAuth": { verifier: string; startedAt: number };
};

type Key = keyof Schema;

export async function get<K extends Key>(key: K): Promise<Schema[K] | null> {
  const raw = await kv.getItemAsync(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as Schema[K];
  } catch {
    // Corrupt or pre-JSON value — drop it rather than crash the auth boot path.
    await kv.deleteItemAsync(key);
    return null;
  }
}

export async function set<K extends Key>(key: K, value: Schema[K]): Promise<void> {
  await kv.setItemAsync(key, JSON.stringify(value));
}

export async function remove(key: Key): Promise<void> {
  await kv.deleteItemAsync(key);
}

/** Logout / refresh-failure path: wipe every auth key, keep the device id. */
export async function clearAuth(): Promise<void> {
  await Promise.all([remove("gg.access"), remove("gg.refresh"), remove("gg.user")]);
}

/**
 * Keys that belong to the PERSON, not the phone. `clearAuth` never touched these, so every one of
 * them used to survive a logout — and, worse, an account deletion — and was then inherited by
 * whoever signed in next on the same device.
 *
 * Concretely, before this existed: you tapped "Delete my account", the server erased you, and your
 * recent searches, tier state and push preferences stayed on the handset for the next user to
 * inherit. For a screen labelled *Danger zone* that is the wrong answer.
 *
 * Deliberately NOT in this list, because they describe the device rather than the account:
 *  - `gg.device`      — the install id; refresh-token families are keyed on it (§5.3)
 *  - `gg.themeMode`   — an appearance preference, read before first paint
 *  - `gg.onboarded`   — the first-run product tour; a second user on this phone has still seen it
 */
const ACCOUNT_SCOPED_KEYS = [
  "gg.setupComplete",
  "gg.setupSportsDismissed",
  "gg.recentSearches",
  "gg.lastSeenTier",
  "gg.pushPrefs",
  "gg.pushToken",
  "gg.pendingDeepLink",
] as const satisfies readonly Key[];

/**
 * Wipe the previous account's traces from this device.
 *
 * **`gg.pendingOrder` is the one judgement call, and it splits by caller.**
 *
 * On LOGOUT it is kept (`keepPendingOrder: true`). That record is the only handle on money that was
 * debited while `/payments/verify` was interrupted — §9.4's cold-start reconciliation is what
 * recovers it. Someone who signs out mid-checkout and back in has not forfeited their payment, and
 * deleting the record here would silently destroy the recovery path for a real charge.
 *
 * On DELETE it goes. The account it belonged to no longer exists, so nothing can reconcile against
 * it: the poll would query `/payments/history` as the *next* user and match nothing forever. A
 * refund there is a support conversation, not a client retry.
 */
export async function clearAccountData(
  { keepPendingOrder }: { keepPendingOrder: boolean },
): Promise<void> {
  const keys: Key[] = [...ACCOUNT_SCOPED_KEYS];
  if (!keepPendingOrder) keys.push("gg.pendingOrder");
  await Promise.all(keys.map(remove));
}

/** Creates the device id on first call and reuses it forever after. */
export async function deviceId(): Promise<string> {
  const existing = await get("gg.device");
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await set("gg.device", id);
  return id;
}
