/**
 * Deep-link routing (Developer PRD §11). One place turns an incoming URL — notification tap,
 * universal/app link, or custom scheme — into navigation, applying auth-gated stash-and-resume
 * and S1.9 validation. Notification taps (M12) call route() directly; external links arrive via
 * expo-linking (cold start + warm). Malformed links breadcrumb and fall back home, never crash.
 */
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { planNavigation } from "@/lib/deeplinks";
import { breadcrumb } from "@/lib/sentry";
import * as storage from "@/lib/storage";

type DeepLinkContextValue = { route: (url: string | null) => void };
const DeepLinkContext = createContext<DeepLinkContextValue | null>(null);

export function DeepLinkProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const isSignedIn = status === "signedIn";

  const route = useCallback(
    (url: string | null) => {
      if (!url) return;
      const plan = planNavigation(url, isSignedIn);
      if (plan.action === "navigate") {
        router.push(plan.path as never);
      } else if (plan.action === "stash-then-login") {
        storage.set("gg.pendingDeepLink", plan.path);
        router.replace("/login");
      } else {
        breadcrumb("deeplink.unresolved", { url });
        router.push("/home");
      }
    },
    [isSignedIn, router],
  );

  // Cold start: a URL that launched the app. Wait until auth has resolved so the
  // signed-in/out branch (and thus stash-vs-navigate) is correct.
  useEffect(() => {
    if (status === "restoring") return;
    Linking.getInitialURL()
      .then((url) => url && route(url))
      .catch(() => {});
  }, [status, route]);

  // Warm / background: links delivered while the app is already running.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => route(url));
    return () => sub.remove();
  }, [route]);

  // Resume: once signed in, consume any stashed target from a logged-out deep link.
  useEffect(() => {
    if (!isSignedIn) return;
    storage.get("gg.pendingDeepLink").then((path) => {
      if (!path) return;
      storage.remove("gg.pendingDeepLink");
      router.push(path as never);
    });
  }, [isSignedIn, router]);

  const value = useMemo(() => ({ route }), [route]);
  return <DeepLinkContext.Provider value={value}>{children}</DeepLinkContext.Provider>;
}

/** Notification taps and any other in-app deep-link source route through this. */
export function useDeepLinkRouter(): DeepLinkContextValue {
  const ctx = useContext(DeepLinkContext);
  if (!ctx) throw new Error("useDeepLinkRouter must be used inside <DeepLinkProvider>");
  return ctx;
}
