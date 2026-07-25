import { Redirect } from "expo-router";

import { useAuth } from "@/hooks/useAuth";

/**
 * Entry route (§5.1): wait for the session restore, then route.
 * Onboarding (first-run) slots in ahead of login in M4.
 */
export default function Index() {
  const { status } = useAuth();
  if (status === "restoring") return null; // splash is still up
  return <Redirect href={status === "signedIn" ? "/home" : "/login"} />;
}
