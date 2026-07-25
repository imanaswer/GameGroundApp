import { color, layout, space, tier, type } from "@/lib/tokens";

test("space is the 4pt scale", () => {
  expect(space(0)).toBe(0);
  expect(space(3)).toBe(12);
});

test("screen gutter is 18 (DESIGN_SYSTEM.md §3)", () => {
  expect(layout.screenX).toBe(18);
});

test("every tier has an accent and a chip background", () => {
  for (const t of Object.values(tier)) {
    expect(t.fg).toBeTruthy();
    expect(t.bg).toBeTruthy();
  }
});

test("serif is never used below 20px (DESIGN_SYSTEM.md §2)", () => {
  for (const style of Object.values(type)) {
    if (style.fontFamily.startsWith("InstrumentSerif")) {
      expect(style.fontSize).toBeGreaterThanOrEqual(20);
    }
  }
});

test("core surfaces are the approved dark values", () => {
  expect(color.bg).toBe("#050505");
  expect(color.card).toBe("#0a0a0a");
});
