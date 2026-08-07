/**
 * Sentry wrapper (Developer PRD §13 deferred init, §S1.3 scrubbing).
 *
 * **Re-enabled on `@sentry/react-native` ~7.2.0 — the version Expo SDK 54 pins.** The launch crash
 * that got this file stubbed was on **7.11.0**, nine minors ahead of the SDK's own
 * `bundledNativeModules.json` entry (`@sentry/react-native: ~7.2.0`), i.e. a version Expo has
 * never tested against this runtime. Sentry's own issue #5679 reports the same shape of failure —
 * an ObjC exception thrown at launch from a void TurboModule method, which has nowhere to return
 * to and terminates the process — on 7.12.x and 8.0.0. So the crash was a version choice, not an
 * incompatibility, and 8.x is NOT the safer answer here: it is further from what SDK 54 ships.
 *
 * **Two independent guards, so "no DSN" cannot reach native code:**
 *  1. `app.config.js` only adds the config plugin when `SENTRY_DSN` is set, so without a DSN there
 *     is no AppDelegate auto-init compiled into the binary at all (that file's own reasoning:
 *     "no DSN, no plugin, no native init, no crash").
 *  2. This module `require`s the SDK lazily, inside `initSentry`, and only after the DSN check.
 *     A static import would pull the native module into the JS bundle's import graph on every
 *     launch including the ones with reporting switched off. The whole failure mode here was
 *     native code running when nothing had asked it to; not importing it is the cheapest way to
 *     be certain that cannot happen again.
 *
 * **Still needs a device pass before it can be called done** — the original fault was native and
 * only appears in a real build. Verify on a physical device with SENTRY_DSN set AND unset.
 */
import type * as SentryTypes from "@sentry/react-native";

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

/**
 * `scrubEvent` for the SDK's concrete shapes (Event, Breadcrumb). It walks any object and returns
 * the same structure, but TypeScript can't see that a `Record<string, unknown>` still satisfies a
 * nominal SDK interface, so the round-trip goes through `unknown`. Kept in one place rather than
 * cast at each call site.
 */
function scrubThrough<T>(value: T): T {
  return scrubEvent(value as unknown as Record<string, unknown>) as unknown as T;
}

/**
 * A Sentry DSN is `https://<key>@<host>/<numeric project id>`. The project id being digits is what
 * rejects the placeholder — `https://...@sentry.io/...` is a well-formed-looking string whose id
 * is dots.
 */
const DSN_SHAPE = /^https?:\/\/[^\s:@/]+(?::[^\s@/]+)?@[^\s/]+\/\d+$/;

/**
 * The DSN if it can actually be sent to, else null.
 *
 * **Truthiness is not enough, and assuming it was shipped a bug.** `.env` carries placeholders for
 * every unconfigured secret — the repo convention, cf. `rzp_test_replace_me` — and `SENTRY_DSN` is
 * `https://...@sentry.io/...`. That is truthy, so it passed the old `!env.sentryDsn` guard, and
 * Sentry then logged "Invalid Sentry Dsn" twice on every launch and initialised a client that could
 * never deliver. It also armed the config plugin in `app.config.js`, i.e. the native auto-init that
 * Decision 28 claimed was unreachable without a DSN. Placeholder == unconfigured, everywhere.
 *
 * Exported so `app.config.js` can be checked against the same rule (it cannot import TypeScript,
 * so it carries a copy — `__tests__/sentry-init.test.ts` asserts the two agree).
 */
export function usableDsn(raw: unknown): string | null {
  // `unknown`, not `string | null`, and the typeof check is the point. This value arrives from
  // `Constants.expoConfig.extra`, which is untyped — `env.ts` *asserts* `as string | null` without
  // verifying, so anything the manifest happens to hold reaches here. Trusting that assertion
  // threw `raw?.trim is not a function` at launch: optional chaining only guards null/undefined,
  // so any other non-string sails past `?.` and dies on the call.
  if (typeof raw !== "string") return null;
  const dsn = raw.trim();
  return dsn && DSN_SHAPE.test(dsn) ? dsn : null;
}

/**
 * The loaded SDK, or null while reporting is off. Every function below no-ops on null, so a build
 * without a DSN behaves exactly as it did while this file was stubbed.
 */
let sentry: typeof SentryTypes | null = null;

/**
 * Called once from the root layout, deferred past the first frame (§13 cold-start budget).
 * Safe to call more than once — the second call is a no-op.
 */
export function initSentry() {
  const dsn = usableDsn(env.sentryDsn);
  if (sentry || !dsn) return;

  try {
    // Lazy on purpose — see guard 2 in the file header.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const loaded = require("@sentry/react-native") as typeof SentryTypes;

    loaded.init({
      dsn, // the validated one, never the raw env value
      environment: env.appEnv,
      // Errors only. Traces and session replay are the two features that have historically shipped
      // launch-time native surprises (#5679 is a replay post-init running when replay is off), and
      // neither earns its risk for the crash-free ≥ 99.5% gate this exists to measure.
      tracesSampleRate: 0,
      enableAutoSessionTracking: true,
      // §S1.3 — nothing leaves the device un-scrubbed, neither the event nor its breadcrumbs.
      beforeSend: (event) => scrubThrough(event),
      beforeBreadcrumb: (crumb) => scrubThrough(crumb),
    });

    sentry = loaded;
  } catch (e) {
    // A failure to start crash reporting must never be the thing that crashes the app — that is
    // the exact trade this file exists to avoid. Swallow, stay disabled, keep the app running.
    if (__DEV__) console.warn("[sentry] init failed; reporting stays off", e);
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!sentry) return;
  sentry.captureException(error, context ? { extra: scrubEvent(context) } : undefined);
}

export function setSentryUser(user: { id: string } | null) {
  // Id only — never email, name or handle (§S1.3).
  sentry?.setUser(user ? { id: user.id } : null);
}

export function breadcrumb(message: string, data?: Record<string, unknown>) {
  sentry?.addBreadcrumb({ message, data: data ? scrubEvent(data) : undefined });
}
