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
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, Modal, StyleSheet, Text, View } from "react-native";

import { useToast } from "@/components/chrome";
import { Button } from "@/components/ds";
import { useAuth } from "@/hooks/useAuth";
import { resolveDeepLink } from "@/lib/deeplinks";
import {
  configureAndroidChannel,
  registerForPush,
  requestPermission,
  subscribeTokenRefresh,
  urlFromResponse,
} from "@/lib/notifications";
import * as storage from "@/lib/storage";
import { color, radius, space, type } from "@/lib/tokens";

type PushContextValue = {
  /** Call after a first successful join/booking to offer reminders (shown once). */
  promptForPush: () => void;
};

const PushContext = createContext<PushContextValue | null>(null);

export function PushProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const { status } = useAuth();
  const signedIn = status === "signedIn";
  const [prePrompt, setPrePrompt] = useState(false);

  const routeTo = useCallback(
    (url: string | null) => {
      const path = url ? resolveDeepLink(url) : null;
      router.push((path ?? "/home") as never);
    },
    [router],
  );

  // Cold-start tap: a notification that launched the app.
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((res) => {
        if (res) routeTo(urlFromResponse(res));
      })
      .catch(() => {});
  }, [routeTo]);

  // Tap while running (background/foreground) → route via data.url.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((res) => {
      routeTo(urlFromResponse(res));
    });
    return () => sub.remove();
  }, [routeTo]);

  // Foreground receipt → in-app toast (OS banner suppressed by the handler). Tap re-routes.
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((n) => {
      const { title, body, data } = n.request.content;
      toast.show({
        title: title ?? "Game Ground",
        body: body ?? undefined,
        onPress: () => routeTo(typeof (data as { url?: string })?.url === "string" ? (data as { url: string }).url : null),
      });
    });
    return () => sub.remove();
  }, [toast, routeTo]);

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
    const granted = (await Notifications.getPermissionsAsync()).status === "granted";
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

  const value = useMemo(() => ({ promptForPush }), [promptForPush]);

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

const styles = StyleSheet.create({
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
});
