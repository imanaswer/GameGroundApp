/**
 * M14 — tier-up fires exactly once, only on a genuine increase (product AC 6.6.1).
 * Testing the pure decision keeps the celebration logic honest without a device.
 */
import { tierUpDecision } from "@/lib/tierUp";

describe("tierUpDecision", () => {
  test("first-ever observation records silently (no celebration)", () => {
    expect(tierUpDecision("gold", null)).toBe("record");
  });

  test("a real promotion celebrates", () => {
    expect(tierUpDecision("gold", "silver")).toBe("celebrate");
    expect(tierUpDecision("pro", "elite")).toBe("celebrate");
  });

  test("same tier again does not re-fire", () => {
    expect(tierUpDecision("gold", "gold")).toBe("skip");
  });

  test("a downgrade (shouldn't happen) never celebrates", () => {
    expect(tierUpDecision("silver", "gold")).toBe("skip");
  });

  test("an unknown stored value is treated as below every tier → celebrate", () => {
    expect(tierUpDecision("bronze", "garbage")).toBe("celebrate");
  });
});
