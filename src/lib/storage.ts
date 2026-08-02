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

/** Creates the device id on first call and reuses it forever after. */
export async function deviceId(): Promise<string> {
  const existing = await get("gg.device");
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await set("gg.device", id);
  return id;
}
