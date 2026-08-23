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

import * as authApi from "@/api/auth";
import { useAuth } from "@/hooks/useAuth";
import { planNavigation, resolveDeepLink } from "@/lib/deeplinks";
import { breadcrumb } from "@/lib/sentry";
import * as storage from "@/lib/storage";

type DeepLinkContextValue = { route: (url: string | null) => void };
const DeepLinkContext = createContext<DeepLinkContextValue | null>(null);

/**
 * `ggredesign://auth-callback?code=...` isn't a navigable route — it's the Google OAuth redirect
 * (see `useGoogleLogin`). `new URL()` reads a custom scheme's first segment as the HOST, so this
 * checks `host`, not `pathname`.
 */
function parseGoogleAuthCallback(url: string): { code: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.host !== "auth-callback") return null;
    const code = parsed.searchParams.get("code");
    return code ? { code } : null;
  } catch {
    return null;
  }
}

export function DeepLinkProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status, adopt } = useAuth();
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
   * Redeem a Google auth redirect that survived as a launch URL rather than a live promise.
   *
   * This only happens when Android killed the process that opened the browser — a freshly
   * installed app has no importance history and is a prime low-memory-killer target while
   * backgrounded for Google's account/consent pages. When that happens, `useGoogleLogin`'s own
   * `await WebBrowser.openAuthSessionAsync(...)` closure died with the old process, so its
   * `verifier` is gone; this reads the one copy that was persisted before the browser opened
   * (`gg.pendingGoogleAuth`) and finishes the exchange here instead.
   *
   * Not reachable from the warm listener below by design — see its comment.
   */
  const completeGoogleAuthFromColdStart = useCallback(
    async (code: string) => {
      const pending = await storage.get("gg.pendingGoogleAuth");
      await storage.remove("gg.pendingGoogleAuth");
      if (!pending) {
        // No stashed verifier — either this callback already reached the live promise before the
        // process died, or the link is stale/replayed. Nothing recoverable; land signed-out users
        // on login same as any other unresolved launch URL, rather than silently doing nothing.
        breadcrumb("deeplink.google-auth-cold-start-no-verifier", {});
        return;
      }
      try {
        adopt(await authApi.exchangeGoogleCode(code, pending.verifier));
      } catch (e) {
        breadcrumb("deeplink.google-auth-cold-start-failed", {
          message: e instanceof Error ? e.message : String(e),
        });
        // Deliberately silent to the user: this is a background recovery attempt on app launch,
        // not a response to a button they just pressed. If it fails, they're simply back at the
        // login screen and can tap Google sign-in again — the ordinary retry path.
      }
    },
    [adopt],
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
        const googleCallback = parseGoogleAuthCallback(url);
        if (googleCallback) return completeGoogleAuthFromColdStart(googleCallback.code);
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
  }, [status, route, completeGoogleAuthFromColdStart]);

  // Warm / background: links delivered while the app is already running.
  useEffect(() => {
    const sub = Linking.addEventListener("url", ({ url }) => {
      // Ignored here on purpose: when the process survives the browser hop (the ordinary case),
      // `useGoogleLogin`'s own `await WebBrowser.openAuthSessionAsync(...)` already owns this
      // redirect and is mid-exchange with the one-time code. Also completing it here would race
      // that exchange — and losing the race means redeeming an already-used code, which the
      // server rejects, surfacing a spurious error to a user who actually just signed in fine.
      if (parseGoogleAuthCallback(url)) return;
      route(url);
    });
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
