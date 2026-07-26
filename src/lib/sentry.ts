/**
 * Sentry wrapper (Developer PRD §13 deferred init, §S1.3 scrubbing).
 *
 * ⚠️ `@sentry/react-native` 7.11 crashes the app at LAUNCH on this stack (RN 0.86 / New Arch /
 * iOS 26): its native Expo AppDelegate auto-init runs `SentrySDKWrapper setupWithDictionary` and
 * throws `NSInvalidArgumentException` — even though we never call `Sentry.init` (no DSN). The
 * native package was removed to unblock the app; re-add it with a version that supports this
 * runtime (or the `@sentry/react-native/expo` plugin with valid options) before shipping.
 * Tracked in BACKLOG. Until then these are no-ops; `scrubEvent` (the tested S1.3 logic) stays.
 */
import { env } from "@/lib/env";

/**
 * S1.3 — strip auth headers, bearer/token strings, and payment signatures before any
 * event leaves the device. Exported so it can be unit-tested against the exit criterion.
 * Kept live so it's ready the moment Sentry is re-enabled.
 */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  const REDACT = "[redacted]";
  const secretKey = /authorization|token|refresh|signature|password|secret/i;
  const secretValue = /Bearer\s+[\w.\-]+|rzp_\w+|eyJ[\w.\-]+/g; // bearer tokens, JWTs, razorpay ids

  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return value.replace(secretValue, REDACT);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = secretKey.test(k) ? REDACT : walk(v);
      return out;
    }
    return value;
  };

  return walk(event) as T;
}

// Referenced so the env import isn't dead while Sentry is disabled (re-used on re-enable).
void env;

export function initSentry() {
  /* disabled — see file header */
}

export function captureException(_error: unknown, _context?: Record<string, unknown>) {
  /* disabled — see file header */
}

export function setSentryUser(_user: { id: string } | null) {
  /* disabled — see file header */
}

export function breadcrumb(_message: string, _data?: Record<string, unknown>) {
  /* disabled — see file header */
}
