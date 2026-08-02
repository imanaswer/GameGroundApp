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
    expect(CreateGameStep.details.safeParse({ paid: true, costAmount: "120" }).success).toBe(true);
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
