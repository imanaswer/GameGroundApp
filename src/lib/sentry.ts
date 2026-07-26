/**
 * Sentry wrapper (Developer PRD §13 deferred init, §S1.3 scrubbing).
 * init() is a no-op without a DSN, so dev/preview without Sentry configured just skips it.
 */
import * as Sentry from "@sentry/react-native";

import { env } from "@/lib/env";

/**
 * S1.3 — strip auth headers, bearer/token strings, and payment signatures before any
 * event leaves the device. Exported so it can be unit-tested against the exit criterion.
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

let started = false;

/** Deferred to post-first-frame by the root layout (§13). Safe to call more than once. */
export function initSentry() {
  if (started || !env.sentryDsn) return;
  started = true;
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.appEnv,
    beforeSend: (event) => scrubEvent(event as unknown as Record<string, unknown>) as never,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!started) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setSentryUser(user: { id: string } | null) {
  if (!started) return;
  Sentry.setUser(user ? { id: user.id } : null);
}

/** Lightweight trail marker (e.g. an unresolved deep link). No-op until Sentry inits. */
export function breadcrumb(message: string, data?: Record<string, unknown>) {
  if (!started) return;
  Sentry.addBreadcrumb({ message, data, level: "info" });
}
