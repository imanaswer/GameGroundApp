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
  useRef,
  type ReactNode,
} from "react";

import { useAuth } from "@/hooks/useAuth";
import { planNavigation, resolveDeepLink } from "@/lib/deeplinks";
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

  /**
   * Cold start: a URL that launched the app. Wait until auth has resolved so the
   * signed-in/out branch (and thus stash-vs-navigate) is correct — then never look again.
   *
   * **Exactly once, hence the ref.** `getInitialURL()` keeps returning the launch URL for the
   * whole process lifetime, and this effect depends on `route`, whose identity changes the moment
   * `isSignedIn` flips. So every successful sign-in re-ran the launch URL through the router. An
   * unmappable one — which is what a development-client launch URL is
   * (`exp+gameground://expo-development-client/?url=…`) — plans `home`, so signing up or logging
   * in fired `router.push("/home")` a beat after the session was adopted. That is what kept
   * yanking the signup acknowledgement and the brand loader off screen: not the screens, this.
   *
   * It reaches production too — any launch from a notification or a universal link arms the same
   * re-fire, and it would land mid-flow rather than at launch.
   */
  const launchUrlConsumed = useRef(false);
  useEffect(() => {
    if (status === "restoring" || launchUrlConsumed.current) return;
    launchUrlConsumed.current = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!url) return;
        /**
         * A launch URL we cannot map is NOT routed home, unlike one that arrives while the app is
         * running. At launch the entry route (app/index.tsx) already owns the destination —
         * onboarding, login or home — and overriding it with `home` both bounces off the tabs'
         * signed-out guard and skips first-run onboarding. Nothing was deep-linked; there is
         * nothing to fall back FROM.
         */
        if (!resolveDeepLink(url)) return breadcrumb("deeplink.launch-unresolved", { url });
        route(url);
      })
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
