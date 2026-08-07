/**
 * Session state (Developer PRD §5.1/§5.2). The only writer of auth storage keys
 * besides api/auth.ts persist. Screens read `useAuth()`; they never touch storage.
 */
import { useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import * as authApi from "@/api/auth";
import { isNoResponse } from "@/api/client";
import type { AuthPayload, SessionUser } from "@/api/types";
import * as analytics from "@/lib/analytics";
import { env } from "@/lib/env";
import { unregisterForPush } from "@/lib/notifications";
import { setSentryUser } from "@/lib/sentry";
import * as storage from "@/lib/storage";

type Status = "restoring" | "signedOut" | "signedIn";

type AuthContextValue = {
  user: SessionUser | null;
  status: Status;
  /** True when the restore fell back to a cached user because the API was unreachable. */
  offline: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) => Promise<void>;
  /**
   * Sign in with Apple (Decision 29). Throws `ERR_REQUEST_CANCELED` when the user dismisses the
   * native sheet — callers treat that as an intentional exit, not an error.
   */
  loginWithApple: () => Promise<void>;
  /**
   * Whether the sign-in that established this session created the account (Decision 32).
   * `null` when the server didn't say, which is every route today — see lib/postAuthRoute.
   */
  isNewAccount: boolean | null;
  /** Social flows land their payload here after the browser handshake. */
  adopt: (payload: AuthPayload) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>("restoring");
  const [offline, setOffline] = useState(false);
  const [isNewAccount, setIsNewAccount] = useState<boolean | null>(null);

  // Cold-start probe (§5.1): tokens → /auth/me (client refreshes on 401 itself).
  useEffect(() => {
    (async () => {
      const access = await storage.get("gg.access");
      if (!access) return setStatus("signedOut");
      try {
        const fresh = await authApi.me();
        await storage.set("gg.user", fresh);
        setUser(fresh);
        setStatus("signedIn");
        analytics.identify(fresh.id, { username: fresh.username });
        setSentryUser({ id: fresh.id });
      } catch (e) {
        const cached = await storage.get("gg.user");
        if (isNoResponse(e) && cached) {
          setUser(cached);
          setOffline(true);
          setStatus("signedIn");
          setSentryUser({ id: cached.id });
        } else {
          await storage.clearAuth();
          setStatus("signedOut");
        }
      }
    })();
  }, []);

  const adopt = useCallback((payload: AuthPayload) => {
    // `?? null` and not `?? false`: "the server didn't say" and "the server said no" route
    // differently, and collapsing them would silently pick one.
    setIsNewAccount(payload.isNew ?? null);
    setUser(payload.user);
    setOffline(false);
    setStatus("signedIn");
    analytics.identify(payload.user.id, { username: payload.user.username });
    setSentryUser({ id: payload.user.id });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => adopt(await authApi.login(email, password)),
    [adopt],
  );

  const register = useCallback(
    async (input: { name: string; username: string; email: string; password: string }) =>
      adopt(await authApi.register(input)),
    [adopt],
  );

  /**
   * Native Sign in with Apple. No browser hop and no PKCE — the OS hands back a signed identity
   * token directly, and the server verifies it against `APPLE_BUNDLE_IDS`.
   *
   * `fullName` is assembled and forwarded because Apple releases it on the FIRST authorization
   * only, and only to the client. It is never in the token, so if it isn't sent now it is lost:
   * the account would be stuck with a placeholder name forever. Empty → null so the server can
   * tell "not offered this time" from an empty string.
   */
  const loginWithApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("Apple sign-in returned no token");
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ");
    adopt(await authApi.loginWithApple(credential.identityToken, fullName || null));
  }, [adopt]);

  // Logout (§5.1): unregister push → revoke → clear SecureStore → clear cache → reset identity.
  const logout = useCallback(async () => {
    await unregisterForPush().catch(() => {});
    await authApi.revoke().catch(() => {});
    await storage.clearAuth();
    queryClient.clear();
    analytics.resetAnalytics();
    setSentryUser(null);
    setUser(null);
    setIsNewAccount(null);
    setStatus("signedOut");
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, offline, isNewAccount, login, register, loginWithApple, adopt, logout }),
    [user, status, offline, isNewAccount, login, register, loginWithApple, adopt, logout],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Whether to offer the Apple button (Decision 29). Three conditions, all required:
 * iOS, the build flag, and the device actually supporting it.
 *
 * `isAvailableAsync` is the one that cannot be assumed: it is false on iOS below 13 and on any
 * build without the entitlement provisioned, and calling `signInAsync` in either case throws
 * rather than degrading. Checking it is what keeps a dead button off the screen.
 *
 * Deliberately NOT a reason to ship without it — see `env.appleAuthEnabled`. On Android this is
 * always false and that is correct: guideline 4.8 is Apple's, and Google stays the only social
 * option there.
 */
export function useAppleAvailable(): boolean {
  const [deviceSupports, setDeviceSupports] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios" || !env.appleAuthEnabled) {
      // Three separate gates and a silently missing button is the same symptom for all of them —
      // which cost a round of "it's still not there". Say which one closed, in dev only, once.
      if (__DEV__) {
        console.log(
          `[apple-auth] button hidden — platform=${Platform.OS} (needs ios), ` +
            `EXPO_PUBLIC_APPLE_AUTH_ENABLED=${env.appleAuthEnabled} (needs true)`,
        );
      }
      return;
    }
    AppleAuthentication.isAvailableAsync().then(
      (supported) => {
        setDeviceSupports(supported);
        // The gate that cannot be reasoned about from config: false on iOS < 13, and on any build
        // whose binary lacks the entitlement — which includes Expo Go, where config plugins never
        // run. A dev-client build is the only place this can legitimately be true.
        if (__DEV__ && !supported) {
          console.log("[apple-auth] button hidden — isAvailableAsync() false (entitlement missing?)");
        }
      },
      () => setDeviceSupports(false),
    );
  }, []);
  return env.appleAuthEnabled && deviceSupports;
}

/**
 * Google sign-in via the website's OAuth client (§5.2, scope change).
 *
 * The app has no Google Cloud client of its own. It opens the site's existing `/api/auth/google`
 * flow in a system browser; the site authenticates exactly as it does on the web and redirects to
 * `/api/auth/google/handoff`, which bounces a one-time code back to this app's URL scheme. The code
 * is then exchanged over HTTPS for a bearer token.
 *
 * `verifier` is the whole security story. A custom scheme is not exclusive — another installed app
 * can register `ggredesign://` and receive the redirect — so the code alone must be useless. Only
 * the SHA-256 goes into the browser; the verifier stays here and is required to redeem.
 *
 * Unlike the native flow this replaced, there is nothing to configure in the app: no client ids, no
 * per-variant OAuth clients, and no extra URL scheme (so no native rebuild).
 */
export function useGoogleLogin(onError: (e: unknown) => void) {
  const { adopt } = useAuth();
  const [busy, setBusy] = useState(false);

  const prompt = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // 32 bytes of entropy, base64url — matches what the server's `isValidChallenge` accepts.
      const verifier = base64url(await Crypto.getRandomBytesAsync(32));
      const challenge = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        verifier,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      ).then(toBase64Url);

      const handoff = `/api/auth/google/handoff?c=${encodeURIComponent(challenge)}`;
      const url = `${env.apiUrl}/api/auth/google?redirect=${encodeURIComponent(handoff)}`;
      // Built from the manifest scheme rather than Linking.createURL: in a dev client that helper
      // can hand back an `exp://<dev-server>` URL, which would never match the fixed
      // `ggredesign://auth-callback` the server redirects to, leaving the browser tab open forever.
      const returnUrl = `${appScheme()}://auth-callback`;

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      // "cancel"/"dismiss" is the user closing the tab — an intentional exit, not an error.
      if (result.type !== "success") return;

      const params = new URL(result.url).searchParams;
      const error = params.get("error");
      if (error) throw new Error(googleErrorMessage(error));
      const code = params.get("code");
      if (!code) throw new Error("Google sign-in returned no code");

      adopt(await authApi.exchangeGoogleCode(code, verifier));
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  }, [busy, adopt, onError]);

  // Always available: the flow depends only on the server's existing Google configuration, so there
  // is no client-side id that can be missing.
  return { available: true, prompt };
}

/** The app's own URL scheme, read from the manifest so it cannot drift from app.config.js. */
function appScheme(): string {
  const scheme = Constants.expoConfig?.scheme;
  return (Array.isArray(scheme) ? scheme[0] : scheme) || "ggredesign";
}

function googleErrorMessage(code: string): string {
  return code === "no_session"
    ? "Google sign-in did not complete. Please try again."
    : "Google sign-in failed. Please try again.";
}

/** expo-crypto returns standard base64 for digests and raw bytes for randoms — normalise both. */
function toBase64Url(value: string): string {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return toBase64Url(global.btoa(binary));
}
