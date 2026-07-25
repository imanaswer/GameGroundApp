import { Redirect } from "expo-router";

/**
 * Entry route. M2 replaces this with the real decision: restore session from SecureStore,
 * then onboarding (first run) | (tabs) (signed in) | (auth)/login.
 */
export default function Index() {
  return <Redirect href="/home" />;
}
