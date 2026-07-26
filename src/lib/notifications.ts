/**
 * Notifications service abstraction (Developer PRD §10.2). Wraps expo-notifications and the
 * push API so screens/hooks stay declarative. Every server call degrades gracefully: when the
 * /api/push/* routes aren't deployed yet, failures are logged as breadcrumbs and swallowed —
 * the app never crashes and re-tries on the next app open.
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import * as pushApi from "@/api/push";
import { captureException } from "@/lib/sentry";
import * as storage from "@/lib/storage";
import { DEFAULT_PREFS, type PushPrefs } from "@/lib/pushCategories";
import { color } from "@/lib/tokens";

/**
 * Foreground policy (§10.2): suppress the OS banner — the app shows an in-app toast instead.
 * Set once at module load so a notification arriving before configure() still behaves.
 */
Notifications.setNotificationHandler({
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
  try {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Game Ground",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: color.red,
    });
  } catch (e) {
    captureException(e, { where: "configureAndroidChannel" });
  }
}

export async function hasPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/** OS permission prompt. Returns whether it ended up granted. */
export async function requestPermission(): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
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

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId: pid });
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
  return Notifications.addPushTokenListener(() => {
    registerForPush();
  });
}

/** The URL a notification wants to open (payloads always carry data.url per §10.1). */
export function urlFromResponse(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { url?: unknown } | undefined;
  return typeof data?.url === "string" ? data.url : null;
}
