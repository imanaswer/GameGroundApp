/**
 * Session state (Developer PRD §5.1/§5.2). The only writer of auth storage keys
 * besides api/auth.ts persist. Screens read `useAuth()`; they never touch storage.
 */
import { useQueryClient } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
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
  loginWithApple: () => Promise<void>;
  /** Social flows land their payload here after the native handshake. */
  adopt: (payload: AuthPayload) => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<Status>("restoring");
  const [offline, setOffline] = useState(false);

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
    setStatus("signedOut");
  }, [queryClient]);

  const value = useMemo(
    () => ({ user, status, offline, login, register, loginWithApple, adopt, logout }),
    [user, status, offline, login, register, loginWithApple, adopt, logout],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/**
 * Native Google Sign-In (§5.2): PKCE via expo-auth-session, idToken → /auth/google/mobile.
 * Hidden until OAuth client ids are configured in the build env.
 */
export function useGoogleLogin(onError: (e: unknown) => void) {
  const { adopt } = useAuth();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: env.googleIosClientId || undefined,
    androidClientId: env.googleAndroidClientId || undefined,
  });

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) return onError(new Error("Google sign-in returned no token"));
    authApi.loginWithGoogle(idToken).then(adopt).catch(onError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const configured =
    Platform.OS === "ios" ? !!env.googleIosClientId : !!env.googleAndroidClientId;
  return { available: configured && !!request, prompt: () => promptAsync() };
}

/** Apple button shows only where Apple auth actually works. */
export function useAppleAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync().then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}
