import { Redirect } from "expo-router";

import { useAuth } from "@/hooks/useAuth";

/**
 * Landing-pad route for `ggredesign://auth-callback?code=...`.
 *
 * This URL is the Google OAuth redirect — it isn't a real screen. But Expo Router's file-based
 * linking intercepts it before any `Linking.addEventListener` fires, and without a matching route
 * file it shows "Unmatched route — page could not be found."
 *
 * The actual auth exchange happens elsewhere:
 *   - **Process alive:** `useGoogleLogin`'s `openAuthSessionAsync` catches the redirect via its
 *     `returnUrl` parameter — this route is never even rendered.
 *   - **Process killed (cold start):** `DeepLinkProvider`'s `completeGoogleAuthFromColdStart`
 *     reads the launch URL and finishes the exchange with the stashed PKCE verifier.
 *
 * This file exists solely so Expo Router has a valid route to land on instead of erroring. It
 * renders nothing while the cold-start handler runs, then redirects based on auth state.
 */
export default function AuthCallback() {
  const { status } = useAuth();

  // Still restoring or the cold-start handler hasn't finished yet — show nothing (splash stays).
  if (status === "restoring") return null;

  // Once auth resolves — either the cold-start handler signed us in, or it failed/was stale —
  // redirect to wherever the user should be.
  return <Redirect href={status === "signedIn" ? "/home" : "/login"} />;
}
