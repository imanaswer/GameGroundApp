import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RegisterSchema } from "@/api/schemas";
import { avatarColors, color, layout, ramp, space, tier, type } from "@/lib/tokens";
import { type Scheme } from "@/theme/palette";
import { setActiveScheme } from "@/theme/runtime";

test("space is the 4pt scale", () => {
  expect(space(0)).toBe(0);
  expect(space(3)).toBe(12);
});

test("screen gutter is 18", () => {
  expect(layout.screenX).toBe(18);
});

/**
 * The palettes answer the SAME keys. The `Palette` type already enforces this at compile time;
 * this asserts it at runtime because the failure mode is `undefined` reaching a native style prop,
 * which RN renders as "no colour" rather than as an error.
 */
test("both palettes define every token, and none is empty", () => {
  setActiveScheme("light");
  const lightKeys = Object.keys(color).sort();
  const lightValues = Object.values(color);
  setActiveScheme("dark");
  const darkKeys = Object.keys(color).sort();
  const darkValues = Object.values(color);
  setActiveScheme("light");

  expect(darkKeys).toEqual(lightKeys);
  for (const v of [...lightValues, ...darkValues]) expect(typeof v === "string" && v.length > 0).toBe(true);
});

/**
 * The two tokens that deliberately do NOT invert. Photographs are dark on any ground, so copy over
 * them is white on any ground; a future "invert everything" pass would break every scrim in the
 * app by fixing these.
 */
test("photographic tokens are theme-invariant", () => {
  const read = (s: Scheme) => {
    setActiveScheme(s);
    return { inverse: color.inverse, onInverse: color.onInverse, splash: color.splash };
  };
  const light = read("light");
  const dark = read("dark");
  setActiveScheme("light");
  expect(dark).toEqual(light);
  // Pinned to app.config.js's expo-splash-screen backgroundColor.
  expect(light.splash).toBe("#050505");
});

/* ── Colour: asserted against BOTH palettes (Decision 24) ─────────────────────
 *
 * `color` and `tier` are theme proxies, so every value below has to be READ inside the test, not
 * captured into a `test.each` table at collection time — a table is built before `beforeAll` runs
 * and would silently assert the light palette twice. That is the one trap in testing a proxy, and
 * it fails by passing.
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

/** Flatten `rgba(...)` or a hex onto an opaque background — a tint is only legible composed. */
function over(fg: string, bg: string): string {
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/.exec(fg);
  const base = bg.replace("#", "");
  const [br, bg_, bb] = [0, 2, 4].map((i) => parseInt(base.slice(i, i + 2), 16));
  let r: number, g: number, b: number, alpha: number;
  if (rgba) {
    [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    alpha = rgba[4] === undefined ? 1 : Number(rgba[4]);
  } else {
    const m = fg.replace("#", "");
    [r, g, b] = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
    alpha = 1;
  }
  const mix = [r * alpha + br * (1 - alpha), g * alpha + bg_ * (1 - alpha), b * alpha + bb * (1 - alpha)];
  return `#${mix.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

describe.each<Scheme>(["light", "dark"])("%s palette", (scheme) => {
  beforeAll(() => setActiveScheme(scheme));
  afterAll(() => setActiveScheme("light"));

  test("every tier has an accent and a chip background", () => {
    for (const t of Object.values(tier)) {
      expect(t.fg).toBeTruthy();
      expect(t.bg).toBeTruthy();
    }
  });

  /**
   * `tier.fg` serves three roles at once and each imposes its own floor — see the note in the
   * palette. A "silver" light enough to look like silver passes as text on its own tint and fails
   * the other two, so these are asserted together: it is the combination that makes the palette
   * possible, and it is why dark needed an invented bronze rather than an inverted one.
   */
  test("every tier accent satisfies all three of its roles", () => {
    for (const [name, t] of Object.entries(tier)) {
      // (2) ring/accent on the page.
      expect(contrast(t.fg, color.bg)).toBeGreaterThanOrEqual(4.5);
      // (3) solid fill under the TierUp trophy, which is drawn in `bg` — NOT `inverse`. That is
      // the one choice that survives both themes: the page colour is white against dark accents
      // and near-black against light ones, so the glyph inverts for free. A hardcoded white
      // trophy would vanish on dark's near-white accents.
      expect(contrast(color.bg, t.fg)).toBeGreaterThanOrEqual(3);
      // (1) TierBadge draws fg on bg, and bg is an alpha tint — compose it rather than trusting
      // the rgba string, because that composition is exactly where a tint like this fails.
      expect(contrast(t.fg, over(t.bg, color.bg))).toBeGreaterThanOrEqual(4.5);
      expect(name).toBeTruthy();
    }
  });

  test("core surfaces are the palette's own, and the page is not the card", () => {
    expect(color.bg).toBe(scheme === "light" ? "#FFFFFF" : "#050505");
    // The wash has to differ from the page or section separation disappears entirely.
    expect(color.card).not.toBe(color.bg);
    // Dark's page must equal the splash background (Decision 18) or the launch handoff steps.
    if (scheme === "dark") expect(color.bg).toBe("#050505");
  });

  test("body and secondary text clear WCAG AA on both surfaces", () => {
    for (const surface of [color.bg, color.card, color.elev]) {
      expect(contrast(color.text, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color.dim, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("dim2 is legible as large/secondary text (AA large, 3:1)", () => {
    // Weakest text token — held to the large-text bar, not the body bar, and never used for body.
    expect(contrast(color.dim2, color.bg)).toBeGreaterThanOrEqual(3);
  });

  test("the primary action carries its own label at AA", () => {
    // `onPrimary` follows `primary` across themes: white on black, black on white.
    expect(contrast(color.onPrimary, color.primary)).toBeGreaterThanOrEqual(4.5);
  });

  /**
   * Filled surfaces carrying a label or glyph. Every one of these was a real bug during the light
   * port: on the old dark ground a near-black label sat on a near-black fill and nobody noticed,
   * because everything was dark. Inverting the app is exactly the move that recreates them, which
   * is why this now runs per palette.
   */
  test("labels on filled surfaces are legible", () => {
    expect(contrast(color.onPrimary, color.primary)).toBeGreaterThanOrEqual(4.5);
    // "Live" badge: a saturated fill with a white label in BOTH themes — it is a signal colour,
    // not a surface, so it does not invert.
    expect(contrast(color.inverse, color.live)).toBeGreaterThanOrEqual(4.5);
    // Completed checkout step: a white check glyph, held to the 3:1 non-text bar.
    expect(contrast(color.inverse, ramp.success[600])).toBeGreaterThanOrEqual(3);
  });

  /**
   * The fill-vs-text split, asserted in BOTH directions for each semantic pair.
   *
   * Direction one is obvious: the text token must be legible. Direction two is the one that
   * matters — the fill token must *fail* as text. Without it, someone folds the pair back into
   * one token, every call site still compiles, and the regression is invisible until a user
   * cannot read a price. Nine call sites were using the fill colour as text before this existed.
   */
  test("semantic pairs read as text only via their text token, never the fill", () => {
    const pairs: [string, string, string][] = [
      ["success", color.successText, color.success],
      ["gold", color.goldText, color.gold],
    ];
    for (const [, textToken, fillToken] of pairs) {
      for (const surface of [color.bg, color.card]) {
        expect(contrast(textToken, surface)).toBeGreaterThanOrEqual(4.5);
      }
      /**
       * Direction two is a LIGHT-palette invariant, and deliberately not asserted on dark. On a
       * white page a saturated mid-tone genuinely fails as text, which is what makes the split
       * necessary. On black the same token measures 9:1 — legible — so asserting it here would
       * be asserting something false to keep a symmetry the physics does not have. The pair still
       * exists in dark because the tokens are one API across themes, not because dark needs it.
       */
      if (scheme === "light") expect(contrast(fillToken, color.bg)).toBeLessThan(4.5);
    }
  });

  /**
   * Avatar identity fills carry white initials, and they sit ON the page — so they have two floors,
   * not one. The second is what the dark set exists for: the light fills are tuned for white
   * initials on a white page and two of them are within a shade of the dark ground, where the disc
   * disappears rather than reads as an avatar.
   */
  test("avatar fills carry white initials and separate from the page", () => {
    setActiveScheme(scheme);
    const fills = avatarColors;
    expect(fills).toHaveLength(8);
    for (const fill of fills) {
      expect(contrast(color.inverse, fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(fill, color.bg)).toBeGreaterThanOrEqual(1.6);
    }
  });

  test("semantic text colours are legible on their own tinted surfaces", () => {
    expect(contrast(color.successText, over(color.successSurface, color.bg))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(color.errorText, over(color.errorSurface, color.bg))).toBeGreaterThanOrEqual(4.5);
  });
});

/** Decision 20 — the ported system has no serif; the type scale must be single-family. */
test("no type role uses the serif", () => {
  for (const style of Object.values(type)) {
    expect(style.fontFamily.startsWith("InstrumentSerif")).toBe(false);
  }
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

/**
 * The password checklist must only assert rules the API actually enforces. The source's own screen lists
 * two; our RegisterSchema requires length alone. Telling a user their valid password is invalid is
 * worse than showing no rules, so this pins the checklist to the schema rather than to the design.
 */
test("password rules shown to the user match what the schema enforces", () => {
  const rulesSrc = readFileSync(join(__dirname, "..", "src/components/auth/fields.tsx"), "utf8");
  const shown = [...rulesSrc.matchAll(/label: "([^"]+)", test:/g)].map((m) => m[1]);
  expect(shown).toHaveLength(1);
  expect(shown[0]).toMatch(/8 characters/i);

  // A password meeting every shown rule must actually pass the schema.
  const ok = RegisterSchema.safeParse({
    name: "Test User",
    username: "test_user",
    email: "a@b.com",
    password: "abcdefgh",
  });
  expect(ok.success).toBe(true);
});
