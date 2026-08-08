/**
 * `src/lib/hostPayment.ts` is a MIRROR of the server's `GG/src/lib/hostPayment.ts`. These tests
 * pin the values that have to agree across the two repos — the enum the server's Zod accepts, and
 * the UPI shape it validates. Drift shows up here rather than as a 422 a host can't interpret.
 */
import {
  HOST_PAYMENT_DISCLAIMER,
  HOST_PAYMENT_METHODS,
  HOST_PAYMENT_METHOD_LABELS,
  VENUE_PAYMENT_DISCLAIMER,
  acceptsUpi,
  canCollect,
  isHostPaymentMethod,
  isValidUpiId,
} from "@/lib/hostPayment";

describe("server mirror", () => {
  test("the method enum matches the server's, in order", () => {
    expect(HOST_PAYMENT_METHODS).toEqual(["upi", "cash", "upi_cash"]);
  });

  test("labels match what the server composes into hostPayment.methodLabel", () => {
    // A player sees the server's label on the game page; the host sees this one while creating.
    // If they disagree, a host picks "UPI + Cash" and players are shown something else.
    expect(HOST_PAYMENT_METHOD_LABELS).toEqual({
      upi: "UPI",
      cash: "Cash",
      upi_cash: "UPI + Cash",
    });
  });

  test("the disclaimer is word-for-word the server's", () => {
    expect(HOST_PAYMENT_DISCLAIMER).toBe(
      "Game Ground does not process payments for player-hosted games.",
    );
  });

  test("the venue disclaimer is word-for-word the web's", () => {
    // Client-side on both platforms — the server never sends this one, so nothing but this test
    // would catch the two wording it differently.
    expect(VENUE_PAYMENT_DISCLAIMER).toBe(
      "The host is responsible for paying the venue/organization. Game Ground is not involved in this transaction.",
    );
  });

  test("isHostPaymentMethod rejects anything outside the enum", () => {
    expect(isHostPaymentMethod("upi_cash")).toBe(true);
    expect(isHostPaymentMethod("card")).toBe(false);
    expect(isHostPaymentMethod(undefined)).toBe(false);
  });
});

describe("acceptsUpi", () => {
  test("true only for the methods that actually take UPI", () => {
    expect(acceptsUpi("upi")).toBe(true);
    expect(acceptsUpi("upi_cash")).toBe(true);
    expect(acceptsUpi("cash")).toBe(false);
    expect(acceptsUpi(null)).toBe(false);
  });
});

describe("isValidUpiId", () => {
  test.each(["sarang@okhdfc", "a.b-c_d@ybl", "9876543210@paytm", "  padded@ok  "])(
    "accepts %s",
    (id) => expect(isValidUpiId(id)).toBe(true),
  );

  test.each([
    ["no at sign", "sarangokhdfc"],
    ["empty handle", "@ybl"],
    ["handle too short", "a@ybl"],
    ["psp starting with a digit", "sarang@1bank"],
    ["empty", ""],
  ])("rejects %s", (_why, id) => expect(isValidUpiId(id)).toBe(false));
});

describe("canCollect", () => {
  test("cash-only is always collectable — nothing to enter", () => {
    expect(canCollect("cash", "", "")).toBe(true);
  });

  test("a UPI game needs an id or a QR, or players are told to pay with no way to", () => {
    expect(canCollect("upi", "", "")).toBe(false);
    expect(canCollect("upi", "sarang@okhdfc", "")).toBe(true);
    expect(canCollect("upi", "", "https://res.cloudinary.com/gg/qr.png")).toBe(true);
  });

  test("a malformed id does not count as collectable on its own", () => {
    expect(canCollect("upi_cash", "notaupiid", "")).toBe(false);
    // ...but a QR still rescues it — the id is optional when there is something to scan.
    expect(canCollect("upi_cash", "notaupiid", "https://res.cloudinary.com/gg/qr.png")).toBe(true);
  });
});
