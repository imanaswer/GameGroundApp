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

  test("size coerces the string count and enforces bounds", () => {
    const ok = CreateGameStep.size.safeParse({ slotsTotal: "10" });
    expect(ok.success && ok.data.slotsTotal).toBe(10);
    expect(CreateGameStep.size.safeParse({ slotsTotal: "1" }).success).toBe(false);
    expect(CreateGameStep.size.safeParse({ slotsTotal: "99" }).success).toBe(false);
  });

  test("full schema accepts a complete valid payload", () => {
    const r = CreateGameSchema.safeParse({
      title: "Evening Football 7s",
      sport: "Football",
      venueId: "v1",
      slotId: "s1",
      slotsTotal: "14",
      description: "Bring water",
    });
    expect(r.success).toBe(true);
  });
});
