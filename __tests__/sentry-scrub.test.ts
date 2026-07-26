/**
 * M4 / S1.3 exit criterion — a Sentry event leaves the device with auth headers,
 * token strings, and payment signatures redacted.
 */
import { scrubEvent } from "@/lib/sentry";

jest.mock("@/lib/env", () => ({ env: { appEnv: "test", sentryDsn: null } }));

test("redacts Authorization headers by key", () => {
  const out = scrubEvent({
    request: { headers: { Authorization: "Bearer abc.def.ghi", "X-Client": "mobile" } },
  });
  expect(out.request.headers.Authorization).toBe("[redacted]");
  expect(out.request.headers["X-Client"]).toBe("mobile");
});

test("redacts token / refresh / signature keys anywhere in the tree", () => {
  const out = scrubEvent({
    extra: { refreshToken: "r-123", razorpay_signature: "sig-xyz", orderId: "order_9" },
  });
  expect(out.extra.refreshToken).toBe("[redacted]");
  expect(out.extra.razorpay_signature).toBe("[redacted]");
  expect(out.extra.orderId).toBe("order_9"); // non-secret survives
});

test("redacts bearer/JWT/razorpay values embedded in free-text strings", () => {
  const out = scrubEvent({
    message: "failed with Authorization: Bearer eyJhbGciOiJIUzI1 and key rzp_live_abc",
  });
  expect(out.message).not.toMatch(/eyJ/);
  expect(out.message).not.toMatch(/rzp_live/);
  expect(out.message).toContain("[redacted]");
});
