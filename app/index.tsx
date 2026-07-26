import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import * as storage from "@/lib/storage";

/**
 * Entry route (§5.1). Waits for the session restore, then routes:
 *   first-ever run → onboarding · signed in → home · otherwise → login.
 * The animated brand mark lives on the native splash, held until fonts + restore resolve.
 */
export default function Index() {
  const { status } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    storage.get("gg.onboarded").then((v) => setOnboarded(v === true));
  }, []);

  if (status === "restoring" || onboarded === null) return null; // splash still up

  if (status === "signedIn") return <Redirect href="/home" />;
  return <Redirect href={onboarded ? "/login" : "/onboarding"} />;
}
