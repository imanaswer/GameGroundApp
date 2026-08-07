/**
 * Sentry re-enable guards (BACKLOG: "Sentry native launch-crash — disabled, needs a
 * runtime-compatible re-add").
 *
 * The crash that got this SDK removed was native code running at launch when nothing had asked it
 * to — `@sentry/react-native` 7.11's AppDelegate auto-init throwing `NSInvalidArgumentException`
 * *while no DSN was configured*. Two guards make that unreachable: `app.config.js` omits the config
 * plugin without a **valid** `SENTRY_DSN`, and `lib/sentry.ts` only `require`s the SDK after the
 * same check. "Valid" rather than "present" is the correction in Decision 30 — a placeholder DSN
 * satisfied the original truthiness test and armed both.
 *
 * The mock for the SDK deliberately THROWS on require. If the module graph ever pulls it in
 * eagerly — a static import added back at the top of lib/sentry.ts, say — these tests fail loudly
 * rather than passing while quietly reintroducing the launch path that broke the app.
 */

type SentryModule = {
  initSentry: () => void;
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
  setSentryUser: (u: { id: string } | null) => void;
  breadcrumb: (m: string, d?: Record<string, unknown>) => void;
  usableDsn: (raw: unknown) => string | null;
};

/** The placeholder that actually ships in `.env`, and the reason `usableDsn` exists. */
const PLACEHOLDER_DSN = "https://...@sentry.io/...";

/* eslint-disable @typescript-eslint/no-require-imports */
const loadSentryLib = (): SentryModule => require("@/lib/sentry") as SentryModule;

const mockEnv = (sentryDsn: string | null) =>
  jest.doMock("@/lib/env", () => ({ env: { appEnv: "test", sentryDsn } }));

const explodingSdk = () =>
  jest.doMock("@sentry/react-native", () => {
    throw new Error("@sentry/react-native must not be required without a DSN");
  });

const fakeSdk = () => {
  const sdk = {
    init: jest.fn(),
    captureException: jest.fn(),
    setUser: jest.fn(),
    addBreadcrumb: jest.fn(),
  };
  jest.doMock("@sentry/react-native", () => sdk);
  return sdk;
};

beforeEach(() => {
  jest.resetModules();
});

describe("a placeholder DSN counts as unconfigured", () => {
  /**
   * Regression for a bug this file shipped with. `.env` carries placeholders for every
   * unconfigured secret, and `SENTRY_DSN=https://...@sentry.io/...` is truthy — so the original
   * `!env.sentryDsn` guard let it through. Sentry then logged "Invalid Sentry Dsn" twice on every
   * launch and built a client that could never deliver, AND the same truthiness check in
   * app.config.js armed the native config plugin: precisely the auto-init path this design is
   * supposed to make unreachable when Sentry isn't set up.
   */
  test("the .env placeholder does not load the SDK", () => {
    mockEnv(PLACEHOLDER_DSN);
    explodingSdk();
    expect(() => loadSentryLib().initSentry()).not.toThrow();
  });

  /**
   * `extra` is untyped, and `env.ts` used to *assert* `as string | null` rather than narrow. So a
   * non-string reached `usableDsn`, where `raw?.trim()` guarded null and undefined and nothing
   * else — `raw?.trim is not a function` at launch, before the try/catch, from inside the very
   * function added to make Sentry safe. `usableDsn` takes `unknown` and must be total.
   */
  test("a non-string from the manifest is rejected, not thrown on", () => {
    mockEnv(null);
    const { usableDsn } = loadSentryLib();

    for (const value of [undefined, 0, 1, true, false, {}, [], { url: "x" }, () => "x", Symbol("s")]) {
      expect(usableDsn(value)).toBeNull();
    }
  });

  test("initSentry survives a manifest holding a non-string DSN", () => {
    jest.doMock("@/lib/env", () => ({ env: { appEnv: "test", sentryDsn: { nested: true } } }));
    explodingSdk();
    expect(() => loadSentryLib().initSentry()).not.toThrow();
  });

  test("usableDsn accepts only a real DSN shape", () => {
    mockEnv(null);
    const { usableDsn } = loadSentryLib();

    expect(usableDsn(PLACEHOLDER_DSN)).toBeNull();
    expect(usableDsn("")).toBeNull();
    expect(usableDsn(null)).toBeNull();
    expect(usableDsn("   ")).toBeNull();
    expect(usableDsn("not-a-dsn")).toBeNull();
    // A numeric project id is what separates the two: the placeholder's id is dots.
    expect(usableDsn("https://k@o1.ingest.us.sentry.io/7654321")).toBe(
      "https://k@o1.ingest.us.sentry.io/7654321",
    );
    expect(usableDsn("  https://k@sentry.io/0  ")).toBe("https://k@sentry.io/0");
  });

  /**
   * app.config.js is CommonJS and cannot import the TypeScript helper, so it carries its own copy
   * of the rule. Two copies drift; this reads the config's source and checks the regex literal is
   * character-for-character the one in sentry.ts.
   */
  test("app.config.js uses the identical DSN rule", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");

    const shapeOf = (src: string) => /const DSN_SHAPE = (\/.*\/);/.exec(src)?.[1];
    const config = shapeOf(readFileSync(join(__dirname, "..", "app.config.js"), "utf8"));
    const lib = shapeOf(readFileSync(join(__dirname, "..", "src", "lib", "sentry.ts"), "utf8"));

    expect(config).toBeDefined();
    expect(config).toBe(lib);
  });
});

describe("without a DSN, nothing native is touched", () => {
  test("initSentry does not require the SDK", () => {
    mockEnv(null);
    explodingSdk();
    expect(() => loadSentryLib().initSentry()).not.toThrow();
  });

  test("every reporting call is a safe no-op", () => {
    mockEnv(null);
    explodingSdk();
    const lib = loadSentryLib();
    lib.initSentry();

    expect(() => lib.captureException(new Error("boom"), { orderId: "o1" })).not.toThrow();
    expect(() => lib.setSentryUser({ id: "u1" })).not.toThrow();
    expect(() => lib.setSentryUser(null)).not.toThrow();
    expect(() => lib.breadcrumb("checkout opened", { entityId: "g1" })).not.toThrow();
  });

  test("reporting calls made before initSentry are also safe", () => {
    // The root layout defers init past the first frame (§13), so this ordering is real.
    mockEnv(null);
    explodingSdk();
    expect(() => loadSentryLib().captureException(new Error("early"))).not.toThrow();
  });
});

describe("with a DSN", () => {
  const DSN = "https://examplePublicKey@o0.ingest.sentry.io/0";

  test("initialises once, with tracing off", () => {
    mockEnv(DSN);
    const sdk = fakeSdk();
    const lib = loadSentryLib();

    lib.initSentry();
    lib.initSentry(); // second call must not re-init

    expect(sdk.init).toHaveBeenCalledTimes(1);
    const opts = sdk.init.mock.calls[0][0] as { dsn: string; tracesSampleRate: number };
    expect(opts.dsn).toBe(DSN);
    // Errors only: tracing and session replay are where the launch-time native surprises live,
    // and neither is needed for the crash-free-sessions gate this exists to measure.
    expect(opts.tracesSampleRate).toBe(0);
  });

  test("beforeSend scrubs secrets out of the event (S1.3)", () => {
    mockEnv(DSN);
    const sdk = fakeSdk();
    loadSentryLib().initSentry();

    const beforeSend = sdk.init.mock.calls[0][0].beforeSend as (e: unknown) => Record<string, any>;
    const out = beforeSend({
      request: { headers: { Authorization: "Bearer abc.def", "X-Client": "mobile" } },
      extra: { razorpay_signature: "sig", orderId: "order_9" },
    });

    expect(out.request.headers.Authorization).toBe("[redacted]");
    expect(out.request.headers["X-Client"]).toBe("mobile");
    expect(out.extra.razorpay_signature).toBe("[redacted]");
    expect(out.extra.orderId).toBe("order_9");
  });

  test("beforeBreadcrumb scrubs too — breadcrumbs leave the device as well", () => {
    mockEnv(DSN);
    const sdk = fakeSdk();
    loadSentryLib().initSentry();

    const beforeBreadcrumb = sdk.init.mock.calls[0][0].beforeBreadcrumb as (
      c: unknown,
    ) => Record<string, any>;
    const out = beforeBreadcrumb({ message: "auth ok with rzp_live_abc", data: { token: "t" } });

    expect(out.message).not.toMatch(/rzp_live/);
    expect(out.data.token).toBe("[redacted]");
  });

  test("context passed to captureException is scrubbed before it is handed over", () => {
    mockEnv(DSN);
    const sdk = fakeSdk();
    const lib = loadSentryLib();
    lib.initSentry();

    lib.captureException(new Error("checkout failed"), { refreshToken: "r-1", entityId: "g1" });

    const [, hint] = sdk.captureException.mock.calls[0] as [unknown, { extra: Record<string, unknown> }];
    expect(hint.extra.refreshToken).toBe("[redacted]");
    expect(hint.extra.entityId).toBe("g1");
  });

  test("only the user id is sent — never email, name or handle (S1.3)", () => {
    mockEnv(DSN);
    const sdk = fakeSdk();
    const lib = loadSentryLib();
    lib.initSentry();

    lib.setSentryUser({ id: "u1", email: "a@b.c", username: "ana" } as { id: string });

    expect(sdk.setUser).toHaveBeenCalledWith({ id: "u1" });
  });

  test("an SDK that fails to start leaves the app running, reporting off", () => {
    // The whole point of this file: crash reporting must never be the thing that crashes the app.
    mockEnv(DSN);
    jest.doMock("@sentry/react-native", () => ({
      init: () => {
        throw new Error("native init blew up");
      },
    }));
    // The failure path warns under __DEV__; that warning is the expected behaviour here, so keep
    // it out of the suite's output rather than letting a passing test look like a broken one.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const lib = loadSentryLib();

    expect(() => lib.initSentry()).not.toThrow();
    expect(() => lib.captureException(new Error("after a failed init"))).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
