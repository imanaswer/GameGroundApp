/**
 * Notifications service abstraction (Developer PRD §10.2). Wraps expo-notifications and the
 * push API so screens/hooks stay declarative. Every server call degrades gracefully: when the
 * /api/push/* routes aren't deployed yet, failures are logged as breadcrumbs and swallowed —
 * the app never crashes and re-tries on the next app open.
 *
 * expo-notifications is unavailable in Expo Go (removed SDK 53). All access goes through the
 * lazy `Notif` getter so the module is only loaded inside a development build.
 * NOTE: We cannot use `import type` from expo-notifications — Metro resolves
 * the import at bundle time and triggers the Expo Go crash before TS strips it.
 */
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";

import * as pushApi from "@/api/push";
import { captureException } from "@/lib/sentry";
import * as storage from "@/lib/storage";
import { DEFAULT_PREFS, type PushPrefs } from "@/lib/pushCategories";
import { color } from "@/lib/tokens";

// expo-notifications is required lazily, so its surface is untyped here by design.
type ExpoNotifications = any;

/** True when running inside Expo Go, where expo-notifications was removed (SDK 53). */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Lazy-loaded expo-notifications — null when running in Expo Go. */
let _notif: ExpoNotifications | null | undefined;
function Notif(): ExpoNotifications | null {
  if (_notif === undefined) {
    // Skip the require entirely in Expo Go: requiring expo-notifications there logs a red
    // error at module-eval time (before our catch can swallow the throw). Only a dev build
    // has the native module, so gate on the execution environment.
    if (isExpoGo) {
      _notif = null;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        _notif = require("expo-notifications");
      } catch {
        _notif = null;
      }
    }
  }
  return _notif;
}

/** True when expo-notifications is available (dev build, not Expo Go). */
export function isAvailable(): boolean {
  return Notif() !== null;
}

/**
 * Foreground policy (§10.2): suppress the OS banner — the app shows an in-app toast instead.
 * Set once at module load so a notification arriving before configure() still behaves.
 * No-ops in Expo Go.
 */
Notif()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Android needs an explicit channel; brand the accent red (§10.2). Safe to call repeatedly. */
export async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const N = Notif();
  if (!N) return;
  try {
    await N.setNotificationChannelAsync("default", {
      name: "Game Ground",
      importance: N.AndroidImportance.DEFAULT,
      lightColor: color.red,
    });
  } catch (e) {
    captureException(e, { where: "configureAndroidChannel" });
  }
}

export async function hasPermission(): Promise<boolean> {
  const N = Notif();
  if (!N) return false;
  try {
    const { status } = await N.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** OS permission prompt. Returns whether it ended up granted. */
export async function requestPermission(): Promise<boolean> {
  const N = Notif();
  if (!N) return false;
  try {
    const { status } = await N.requestPermissionsAsync();
    return status === "granted";
  } catch (e) {
    captureException(e, { where: "requestPermission" });
    return false;
  }
}

function projectId(): string | null {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return typeof id === "string" ? id : null;
}

/**
 * Fetch the Expo push token and register it with the server. No-ops (gracefully) without a
 * projectId or permission. Registration is retried with backoff, then left for the next
 * app open — a missing backend must not surface to the user.
 */
export async function registerForPush(): Promise<void> {
  if (!(await hasPermission())) return;
  const pid = projectId();
  if (!pid) return; // dev/simulator without EAS — nothing to register

  const N = Notif();
  if (!N) return;
  let token: string;
  try {
    const res = await N.getExpoPushTokenAsync({ projectId: pid });
    token = res.data;
  } catch (e) {
    captureException(e, { where: "getExpoPushToken" });
    return;
  }

  await storage.set("gg.pushToken", token);
  const input: pushApi.RegisterInput = {
    expoPushToken: token,
    platform: Platform.OS === "ios" ? "ios" : "android",
    deviceId: await storage.deviceId(),
  };

  // Retry a few times with backoff; give up silently (next app open tries again).
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pushApi.register(input);
      return;
    } catch (e) {
      if (attempt === 2) captureException(e, { where: "push.register", attempt });
      else await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

/** Best-effort unregister on logout, before tokens are cleared. */
export async function unregisterForPush(): Promise<void> {
  const token = await storage.get("gg.pushToken");
  if (!token) return;
  try {
    await pushApi.unregister(token);
  } catch (e) {
    captureException(e, { where: "push.unregister" });
  }
  await storage.remove("gg.pushToken");
}

/* ── Preferences (local-first, mirrored to server) ─────────────────────────*/

export async function loadPrefs(): Promise<Record<string, boolean>> {
  const saved = await storage.get("gg.pushPrefs");
  return { ...DEFAULT_PREFS, ...(saved ?? {}) };
}

/** Persist locally (offline source of truth) then mirror to the server, tolerant of failure. */
export async function savePrefs(prefs: Record<string, boolean>): Promise<void> {
  await storage.set("gg.pushPrefs", prefs);
  try {
    await pushApi.updatePrefs(prefs as PushPrefs);
  } catch (e) {
    captureException(e, { where: "push.updatePrefs" });
    // Local stays authoritative offline; a later successful save reconciles the server.
  }
}

/* ── Token refresh + tap routing subscriptions ─────────────────────────────*/

/** Re-register when the OS rotates the push token. Returns an unsubscribe. */
export function subscribeTokenRefresh(): { remove: () => void } {
  const N = Notif();
  if (!N) return { remove: () => {} };
  return N.addPushTokenListener(() => {
    registerForPush();
  });
}

/** The URL a notification wants to open (payloads always carry data.url per §10.1). */
export function urlFromResponse(response: any | null): string | null {
  const data = response?.notification.request.content.data as { url?: unknown } | undefined;
  return typeof data?.url === "string" ? data.url : null;
}
