/** M7 — per-step create-game validation. Each step gates independently before advancing. */
import { CreateGameSchema, CreateGameStep } from "@/api/schemas";

describe("per-step validation", () => {
  test("basics rejects a short title and a missing sport", () => {
    const r = CreateGameStep.basics.safeParse({ title: "hi", sport: "" });
    expect(r.success).toBe(false);
    const fields = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["title", "sport"]));
  });

  test("venue requires both venueId and slotId", () => {
    expect(CreateGameStep.venue.safeParse({ venueId: "v1", slotId: "" }).success).toBe(false);
    expect(CreateGameStep.venue.safeParse({ venueId: "v1", slotId: "s1" }).success).toBe(true);
  });

  test("size coerces the player count, enforces 2–100, and requires a valid skill level", () => {
    const ok = CreateGameStep.size.safeParse({ slots: "10", skillLevel: "All Levels" });
    expect(ok.success && ok.data.slots).toBe(10);
    expect(CreateGameStep.size.safeParse({ slots: "1", skillLevel: "All Levels" }).success).toBe(false);
    expect(CreateGameStep.size.safeParse({ slots: "101", skillLevel: "All Levels" }).success).toBe(false);
    // "Any" is not a server skill level — the picker must send one of the enum values.
    expect(CreateGameStep.size.safeParse({ slots: "10", skillLevel: "Any" }).success).toBe(false);
  });

  test("details requires an amount only when the game is paid", () => {
    expect(CreateGameStep.details.safeParse({ paid: false }).success).toBe(true);
    expect(CreateGameStep.details.safeParse({ paid: true, costAmount: "0" }).success).toBe(false);
    // A paid game now also needs payment terms — see the host-payment block below.
    expect(
      CreateGameStep.details.safeParse({
        paid: true,
        costAmount: "120",
        paymentMethod: "cash",
      }).success,
    ).toBe(true);
  });

  test("full schema accepts a complete valid payload (server body shape)", () => {
    const r = CreateGameSchema.safeParse({
      title: "Evening Football 7s",
      sport: "Football",
      slotId: "s1",
      slots: "14",
      skillLevel: "Intermediate",
      cost: "Free",
      costAmount: 0,
      description: "Bring water",
    });
    expect(r.success).toBe(true);
  });
});

/**
 * Host-direct payment (web `CreateGameSchema` + `src/lib/hostPayment.ts`).
 *
 * The regression these lock down: a paid game submitted without `paymentMethod` was rejected by
 * the server with a 422 the stepper couldn't map to a field, so the host saw a bare
 * "Validation error" toast and had no way to find out what was wrong.
 */
const PAID = { paid: true, costAmount: "120" } as const;

describe("host payment terms", () => {
  test("a paid game must say how players pay — the exact server refinement", () => {
    const r = CreateGameStep.details.safeParse(PAID);
    expect(r.success).toBe(false);
    const issue = r.success ? null : r.error.issues.find((i) => i.path[0] === "paymentMethod");
    // Path matters as much as the failure: `create.tsx` maps it back to a step via FIELD_STEP.
    expect(issue?.message).toBe("Choose how players pay you");
  });

  test("a free game carries no payment terms and is still valid", () => {
    expect(CreateGameStep.details.safeParse({ paid: false }).success).toBe(true);
    // Leftovers from toggling Paid → Free must not block the step.
    expect(
      CreateGameStep.details.safeParse({ paid: false, hostUpiId: "half-typed" }).success,
    ).toBe(true);
  });

  test("cash-only needs neither a UPI ID nor a QR", () => {
    expect(CreateGameStep.details.safeParse({ ...PAID, paymentMethod: "cash" }).success).toBe(true);
  });

  test.each(["upi", "upi_cash"] as const)(
    "%s requires a UPI ID or a QR — otherwise players are told to pay with no way to",
    (paymentMethod) => {
      expect(CreateGameStep.details.safeParse({ ...PAID, paymentMethod }).success).toBe(false);
      expect(
        CreateGameStep.details.safeParse({ ...PAID, paymentMethod, hostUpiId: "sarang@okhdfc" })
          .success,
      ).toBe(true);
      // A QR alone is enough — the id is optional when there is something to scan.
      expect(
        CreateGameStep.details.safeParse({
          ...PAID,
          paymentMethod,
          hostQrUrl: "https://res.cloudinary.com/x/qr.png",
        }).success,
      ).toBe(true);
    },
  );

  test("a malformed UPI ID is caught before submit, not by a 422", () => {
    const r = CreateGameStep.details.safeParse({
      ...PAID,
      paymentMethod: "upi",
      hostUpiId: "notaupiid",
    });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toContain("hostUpiId");
  });

  test("notes are capped at the server's 300 characters", () => {
    const over = "x".repeat(301);
    const base = { ...PAID, paymentMethod: "cash" } as const;
    expect(CreateGameStep.details.safeParse({ ...base, paymentNote: over }).success).toBe(false);
    expect(CreateGameStep.details.safeParse({ ...base, venueNote: over }).success).toBe(false);
    expect(
      CreateGameStep.details.safeParse({ ...base, paymentNote: "x".repeat(300) }).success,
    ).toBe(true);
  });
});

describe("full body shape (POST /games)", () => {
  const BODY = {
    title: "Evening Baskets",
    sport: "Basketball",
    slotId: "s1",
    slots: "10",
    skillLevel: "All Levels",
    cost: "₹120",
    costAmount: 120,
  };

  test("mirrors the server refine: costAmount > 0 without a method is rejected", () => {
    expect(CreateGameSchema.safeParse(BODY).success).toBe(false);
    expect(CreateGameSchema.safeParse({ ...BODY, paymentMethod: "upi_cash" }).success).toBe(true);
  });

  test("hostQrUrl must be an absolute URL — a local file uri would 422 server-side", () => {
    const withMethod = { ...BODY, paymentMethod: "upi" };
    expect(
      CreateGameSchema.safeParse({ ...withMethod, hostQrUrl: "file:///tmp/qr.jpg" }).success,
    ).toBe(false);
    expect(
      CreateGameSchema.safeParse({
        ...withMethod,
        hostQrUrl: "https://res.cloudinary.com/gg/image/upload/qr.png",
      }).success,
    ).toBe(true);
  });

  test("costAmount is capped at the server's 100000", () => {
    expect(
      CreateGameSchema.safeParse({ ...BODY, costAmount: 100001, paymentMethod: "cash" }).success,
    ).toBe(false);
  });
});
