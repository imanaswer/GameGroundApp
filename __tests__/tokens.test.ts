import { color, gray, layout, ramp, space, tier, type } from "@/lib/tokens";

test("space is the 4pt scale", () => {
  expect(space(0)).toBe(0);
  expect(space(3)).toBe(12);
});

test("screen gutter is 18", () => {
  expect(layout.screenX).toBe(18);
});

test("every tier has an accent and a chip background", () => {
  for (const t of Object.values(tier)) {
    expect(t.fg).toBeTruthy();
    expect(t.bg).toBeTruthy();
  }
});

/** Decision 20 — the ported system has no serif; the type scale must be single-family. */
test("no type role uses the serif", () => {
  for (const style of Object.values(type)) {
    expect(style.fontFamily.startsWith("InstrumentSerif")).toBe(false);
  }
});

test("core surfaces are the ported light values (Decision 20)", () => {
  expect(color.bg).toBe("#FFFFFF");
  expect(color.card).toBe(gray[100]);
  expect(color.text).toBe(gray[900]);
});

/**
 * The light port's real risk is contrast: on `#050505` almost any light text passed, on white a
 * mid-grey silently fails. These assert the pairings the app actually renders, so a future token
 * tweak that looks harmless cannot quietly drop text below WCAG AA.
 */
function relLuminance(hex: string): number {
  const m = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [l1, l2] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

test("body and secondary text clear WCAG AA on both surfaces", () => {
  for (const surface of [color.bg, color.card]) {
    expect(contrast(color.text, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.dim, surface)).toBeGreaterThanOrEqual(4.5);
  }
});

test("dim2 is legible as large/secondary text (AA large, 3:1)", () => {
  // Weakest text token — held to the large-text bar, not the body bar, and never used for body.
  expect(contrast(color.dim2, color.bg)).toBeGreaterThanOrEqual(3);
});

test("primary action carries white label at AA", () => {
  expect(contrast(color.inverse, color.red)).toBeGreaterThanOrEqual(4.5);
});

/**
 * Filled surfaces carrying a label or glyph. Every one of these was a real bug found during the
 * Phase 2 port: on the old #050505 ground a near-black label sat on a near-black-adjacent fill and
 * nobody noticed, because everything was dark. On white, the fills went dark and the labels did
 * not follow. These assert the label colour against the fill it actually sits on.
 */
test("labels on filled surfaces are legible", () => {
  // Primary button / selected chip / segmented pill — all the black fill, all white labels.
  expect(contrast(color.inverse, color.red)).toBeGreaterThanOrEqual(4.5);
  // "Live" badge text and dot.
  expect(contrast(color.inverse, color.liveRed)).toBeGreaterThanOrEqual(4.5);
  // Completed checkout step: a white check glyph, held to the 3:1 non-text bar.
  expect(contrast(color.inverse, ramp.success[600])).toBeGreaterThanOrEqual(3);
});

test("success reads as text only via successText, never the fill colour", () => {
  for (const surface of [color.bg, color.card]) {
    expect(contrast(color.successText, surface)).toBeGreaterThanOrEqual(4.5);
  }
  // Guards the trap: the fill colour must NOT be mistaken for a text colour on light surfaces.
  expect(contrast(color.success, color.bg)).toBeLessThan(4.5);
});

test("semantic text colors are legible on their own tinted surfaces", () => {
  expect(contrast(ramp.success[700], color.successSurface)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(ramp.error[700], color.redSurface)).toBeGreaterThanOrEqual(4.5);
});

/** Sizes and tracking are lifted from the Figma exactly; leading is deliberately not (see tokens). */
test("type scale matches the extracted Figma metrics", () => {
  expect(type.display.fontSize).toBe(32);
  expect(type.display.letterSpacing).toBeCloseTo(-0.96, 2);
  expect(type.authTitle.fontSize).toBe(28);
  expect(type.authTitle.letterSpacing).toBeCloseTo(-0.7, 2);
  expect(type.title1.fontSize).toBe(20);
  expect(type.body.fontSize).toBe(14);
  expect(type.caption.fontSize).toBe(12);
  expect(type.micro.fontSize).toBe(10);
});

/** The source file sets 1.0 leading on wrapping roles; we lift it. Guards that we keep doing so. */
test("wrapping roles have leading above 1.2x", () => {
  for (const role of [type.body, type.bodyStrong, type.caption] as const) {
    expect(role.lineHeight / role.fontSize).toBeGreaterThan(1.2);
  }
});

/** Uppercase micro-type needs opening up, not tightening — inverted from the source's -2%. */
test("label tracking is positive", () => {
  expect(type.label.letterSpacing).toBeGreaterThan(0);
  expect(type.label.textTransform).toBe("uppercase");
});
