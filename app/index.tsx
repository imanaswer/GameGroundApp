import { Redirect } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import * as storage from "@/lib/storage";

/**
 * Entry route (§5.1). Waits for the session restore, then routes once:
 *   first-ever run → onboarding · signed in → home · otherwise → login.
 *
 * **It decides exactly once, and never re-decides.** This screen sits at the bottom of the stack,
 * so it stays mounted while the auth screens are on top of it — and it used to re-evaluate on
 * every auth change. The moment signup called `register()` and the status flipped to `signedIn`,
 * this fired `<Redirect href="/home" />` from underneath and won the race against signup's own
 * success screen. The user never saw the acknowledgement or the loader: they were rendered, and
 * then immediately replaced by a redirect from a screen they could not see.
 *
 * Latching the decision keeps this an ENTRY router rather than a permanent auth guard. Screens
 * that own a post-auth flow (signup's acknowledgement → loader → home) can now finish it.
 * Sign-out is still handled where it belongs — `(tabs)/_layout` redirects signed-out users.
 */
export default function Index() {
  const { status } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const decision = useRef<string | null>(null);

  useEffect(() => {
    storage.get("gg.onboarded").then((v) => setOnboarded(v === true));
  }, []);

  if (decision.current) return <Redirect href={decision.current as "/home"} />;

  if (status === "restoring" || onboarded === null) return null; // splash still up

  decision.current = status === "signedIn" ? "/home" : onboarded ? "/login" : "/onboarding";
  return <Redirect href={decision.current as "/home"} />;
}
