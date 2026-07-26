/**
 * PostHog wrapper (Developer PRD §13 deferred init). Event names follow
 * `mobile_<domain>_<action>` (§16.5). No-op without a key so dev stays quiet.
 * Autocapture stays OFF on checkout screens (§S1.3) — capture calls there are explicit.
 */
import PostHog from "posthog-react-native";

import { env } from "@/lib/env";

let client: PostHog | null = null;

/** Deferred to post-first-frame by the root layout (§13). */
export function initAnalytics() {
  if (client || !env.posthogKey) return;
  client = new PostHog(env.posthogKey, { host: "https://us.i.posthog.com" });
}

/** JSON-safe property bag — PostHog rejects anything that won't serialize. */
type Props = Record<string, string | number | boolean | null>;

export function capture(event: `mobile_${string}`, props?: Props) {
  client?.capture(event, props);
}

export function identify(userId: string, props?: Props) {
  client?.identify(userId, props);
}

/** Logout — drop the identity so the next user isn't merged into this one (§5.1). */
export function resetAnalytics() {
  client?.reset();
}
