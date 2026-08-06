/**
 * Push runtime + contextual permission (Developer PRD §10.2). Mounted once as <PushProvider>.
 *
 * - Runtime: on sign-in with permission granted → register token, re-register on app
 *   foreground and on token refresh; route notification taps (killed / background / foreground)
 *   via lib/deeplinks; foreground notifications suppress the OS banner and show an in-app toast.
 * - Contextual permission: never on first launch. Screens call promptForPush() after the first
 *   successful join/booking; a pre-prompt sheet gates the OS dialog (§10.2). Shown once.
 *
 * With the backend push routes undeployed, registration/prefs failures are swallowed by the
 * service layer — this provider never throws into the UI.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, Text, View } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

import { useToast } from "@/components/chrome";
import { Button } from "@/components/ds";
import { useAuth } from "@/hooks/useAuth";
import { useDeepLinkRouter } from "@/hooks/useDeepLinks";
import {
  configureAndroidChannel,
  registerForPush,
  requestPermission,
  subscribeTokenRefresh,
  urlFromResponse,
} from "@/lib/notifications";
import * as storage from "@/lib/storage";
import { color, radius, space, type } from "@/lib/tokens";
import { themed, useThemedStyles } from "@/theme/runtime";

// expo-notifications is loaded lazily (absent in Expo Go), so its surface is untyped by design.
type ExpoNotifications = any;

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Lazy accessor for expo-notifications — null in Expo Go. */
let _notif: ExpoNotifications | null | undefined;
function Notif(): ExpoNotifications | null {
  if (_notif === undefined) {
    // Requiring expo-notifications in Expo Go logs a red error at eval time, so skip it there.
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

type PushContextValue = {
  /** Call after a first successful join/booking to offer reminders (shown once). */
  promptForPush: () => void;
  /**
   * Go straight to the OS dialog, for a caller that has ALREADY explained itself — account
   * setup's notification step, whose whole screen is the pre-prompt §10.2 requires (Decision 23).
   * Resolves to whether permission ended up granted. Never call this from a bare button.
   */
  enablePush: () => Promise<boolean>;
};

const PushContext = createContext<PushContextValue | null>(null);

export function PushProvider({ children }: { children: ReactNode }) {
  const styles = useThemedStyles(sheets);
  const toast = useToast();
  const { status } = useAuth();
  const { route } = useDeepLinkRouter(); // shared validate → navigate / stash / home
  const signedIn = status === "signedIn";
  const [prePrompt, setPrePrompt] = useState(false);

  // Cold-start tap: a notification that launched the app.
  useEffect(() => {
    Notif()?.getLastNotificationResponseAsync()
      .then((res: any) => {
        if (res) route(urlFromResponse(res));
      })
      .catch(() => {});
  }, [route]);

  // Tap while running (background/foreground) → route via data.url.
  useEffect(() => {
    const N = Notif();
    if (!N) return;
    const sub = N.addNotificationResponseReceivedListener((res: any) => {
      route(urlFromResponse(res));
    });
    return () => sub.remove();
  }, [route]);

  // Foreground receipt → in-app toast (OS banner suppressed by the handler). Tap re-routes.
  useEffect(() => {
    const N = Notif();
    if (!N) return;
    const sub = N.addNotificationReceivedListener((n: any) => {
      const { title, body, data } = n.request.content;
      toast.show({
        title: title ?? "GameGround",
        body: body ?? undefined,
        onPress: () => route(typeof (data as { url?: string })?.url === "string" ? (data as { url: string }).url : null),
      });
    });
    return () => sub.remove();
  }, [toast, route]);

  // Registration lifecycle: only when signed in. Re-register on app foreground + token refresh.
  useEffect(() => {
    if (!signedIn) return;
    configureAndroidChannel();
    registerForPush();
    const tokenSub = subscribeTokenRefresh();
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") registerForPush();
    });
    return () => {
      tokenSub.remove();
      appSub.remove();
    };
  }, [signedIn]);

  const promptForPush = useCallback(async () => {
    if (!signedIn) return;
    const seen = await storage.get("gg.pushPromptSeen");
    if (seen) return; // shown once; the OS/Settings own it thereafter
    // Skip the pre-prompt entirely if permission is already granted.
    const N = Notif();
    if (!N) {
      // No notifications in Expo Go — skip entirely.
      return;
    }
    const granted = (await N.getPermissionsAsync()).status === "granted";
    if (granted) {
      await storage.set("gg.pushPromptSeen", true);
      registerForPush();
      return;
    }
    setPrePrompt(true);
  }, [signedIn]);

  const accept = useCallback(async () => {
    setPrePrompt(false);
    await storage.set("gg.pushPromptSeen", true);
    if (await requestPermission()) {
      await configureAndroidChannel();
      registerForPush();
    }
  }, []);

  const decline = useCallback(async () => {
    setPrePrompt(false);
    await storage.set("gg.pushPromptSeen", true); // don't nag; Settings can re-enable
  }, []);

  /**
   * Marks the prompt as seen BEFORE asking, exactly as `accept` does: the OS dialog is one-shot
   * per install, so once it has been raised there is nothing left for the contextual prompt to
   * raise later. A user who SKIPS the setup step is untouched here and still meets the §10.2
   * prompt after their first join — skipping a question is not a refusal.
   */
  const enablePush = useCallback(async () => {
    const N = Notif();
    if (!N) return false; // Expo Go — nothing to ask, and nothing to record.
    await storage.set("gg.pushPromptSeen", true);
    if (!(await requestPermission())) return false;
    await configureAndroidChannel();
    registerForPush();
    return true;
  }, []);

  const value = useMemo(() => ({ promptForPush, enablePush }), [promptForPush, enablePush]);

  return (
    <PushContext.Provider value={value}>
      {children}
      <Modal visible={prePrompt} transparent animationType="fade" onRequestClose={decline}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text style={styles.title}>Want a reminder before your game?</Text>
            <Text style={styles.body}>
              We’ll send a heads-up before it starts, plus waitlist and payment updates. You can
              fine-tune these anytime in Settings.
            </Text>
            <Button title="Turn on reminders" onPress={accept} />
            <Button title="Not now" variant="ghost" onPress={decline} />
          </View>
        </View>
      </Modal>
    </PushContext.Provider>
  );
}

export function usePush(): PushContextValue {
  const ctx = useContext(PushContext);
  if (!ctx) throw new Error("usePush must be used inside <PushProvider>");
  return ctx;
}

const sheets = themed(() => ({
  backdrop: { flex: 1, backgroundColor: color.scrim, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: color.elev,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: space(5),
    paddingBottom: space(10),
    gap: space(3),
  },
  title: { ...type.title2, color: color.text },
  body: { ...type.body, color: color.dim, lineHeight: 20, marginBottom: space(2) },
}));
