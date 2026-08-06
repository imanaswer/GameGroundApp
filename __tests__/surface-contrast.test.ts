import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { color, gradient, gray, ramp, tier } from "@/lib/tokens";
import { setActiveScheme } from "@/theme/runtime";
import { THEMES, type Scheme } from "@/theme/palette";

/**
 * Static audit: any StyleSheet entry that sets BOTH a fill and a text colour must be legible.
 *
 * The light port produced fourteen bugs of exactly one shape — a fill inverted to dark while the
 * label sitting on it stayed dark, or vice versa. Invisible text, a 2.2:1 price, a notification
 * wearing an error tint. Every one was invisible to typecheck and lint, and each was found by a
 * human reading for the pattern, which does not scale and does not survive the next contributor.
 *
 * Run against BOTH palettes (Decision 24). The same co-located pair can pass on white and fail
 * on black — a `dim` label on a `card` fill inverts differently in each — so a single-theme audit
 * would certify half the app.
 *
 * This resolves token references in the same object literal and asserts the pair. It is
 * necessarily incomplete — it cannot see a label whose colour is set in a sibling style, or a
 * fill applied conditionally — so it is a floor, not a proof. It catches the co-located case,
 * which is where all fourteen lived.
 */

/** Built per scheme: `color` and `tier` are theme proxies, so this must be read, not cached. */
function tokenMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(color)) if (typeof v === "string") map[`color.${k}`] = v;
  for (const [k, v] of Object.entries(gray)) map[`gray[${k}]`] = v;
  for (const [name, steps] of Object.entries(ramp))
    for (const [step, v] of Object.entries(steps)) map[`ramp.${name}[${step}]`] = v;
  for (const [name, t] of Object.entries(tier)) {
    map[`tier.${name}.fg`] = t.fg;
    map[`tierMap.${name}.fg`] = t.fg;
  }
  return map;
}

function relLuminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1];
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number | null {
  const [la, lb] = [relLuminance(a), relLuminance(b)];
  if (la === null || lb === null) return null; // rgba()/transparent — cannot judge statically
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });

describe.each<Scheme>(["light", "dark"])("%s palette", (scheme) => {
  beforeAll(() => setActiveScheme(scheme));
  afterAll(() => setActiveScheme("light"));

  test("co-located fill + text colours in StyleSheets meet WCAG AA", () => {
  const TOKENS = tokenMap();
  const failures: string[] = [];

  for (const file of [join(__dirname, "..", "src"), join(__dirname, "..", "app")].flatMap(walk)) {
    const text = readFileSync(file, "utf8");
    // Style entries are `name: { ... }` one-liners or short blocks inside StyleSheet.create.
    for (const [, body] of text.matchAll(/\{([^{}]*backgroundColor:[^{}]*)\}/g)) {
      const bg = /backgroundColor:\s*([A-Za-z0-9_.[\]]+)/.exec(body)?.[1];
      const fg = /(?<!background)(?<![A-Za-z])color:\s*([A-Za-z0-9_.[\]]+)/.exec(body)?.[1];
      if (!bg || !fg) continue;
      const bgHex = TOKENS[bg];
      const fgHex = TOKENS[fg];
      if (!bgHex || !fgHex) continue;
      const ratio = contrast(fgHex, bgHex);
      if (ratio !== null && ratio < 4.5) {
        failures.push(`${file.split(/[\/]/).pop()}: ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
      }
    }
  }

  expect(failures).toEqual([]);
  });

  /**
   * A pair the walker structurally cannot see: both TabBar label colours are applied in JSX.
   *
   * Worth asserting by hand because the bar is the entire navigation and, since Decision 20 took
   * the accent out of it, ink-vs-idle IS the selection signal. The labels are 10px, so both are held
   * to the 4.5:1 small-text bar, not the 3:1 large one.
   *
   * Now measured against `tabBarBg` ITSELF. It used to be measured against `color.bg` for a reason
   * that has gone away: the fill was an rgba tint left over from the removed BlurView, which
   * `contrast()` cannot judge, so the page underneath was the closest honest stand-in. The bar is
   * opaque, so the real surface is assertable — and the page is now also asserted, because content
   * still scrolls up to the bar's edge and a label must not depend on which of the two it is over.
   */
  test("TabBar ink and idle labels clear AA on the bar and over the page", () => {
    for (const surface of [color.tabBarBg, color.bg]) {
      for (const role of ["text", "dim"] as const) {
        const ratio = contrast(color[role], surface);
        expect(ratio).not.toBeNull();
        expect(ratio as number).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  /**
   * The bar must be a SURFACE, not a tint. Two things this pins, both of which were broken:
   *
   *  - Opaque. An rgba fill returns null from `contrast()`, so this fails outright on a tint — which
   *    is the state that let card titles read through the tab labels on device.
   *  - Distinguishable from the page, so the bar has an edge of its own beyond the hairline. Held to
   *    a low bar (1.05) because the separation is deliberately subtle in light, where the bar is
   *    white on white and the hairline does most of the work.
   */
  test("the tab bar is an opaque surface, not a translucent tint", () => {
    expect(color.tabBarBg).toMatch(/^#[0-9a-fA-F]{6}$/);
    const vsPage = contrast(color.tabBarBg, color.bg);
    expect(vsPage).not.toBeNull();
    expect(vsPage as number).toBeGreaterThanOrEqual(1.0);
  });

  /**
   * A card's edge must be VISIBLE against the page it sits on, in both themes.
   *
   * Cards were borderless (Phase 5's editorial treatment) and on the dark ground that left a rail
   * of unbounded images — reported on device. The border is back, and this pins the thing that
   * actually failed: not whether a border is declared, but whether the token carrying it can be
   * seen. A hairline is not text, so the AA ratios do not apply; the floor here is 1.2:1, which the
   * subtler of the two (light's Gray/200 on white, 1.27:1) clears and a token swapped to something
   * near-page-coloured would not.
   *
   * `border` and `border2` are asserted together because DS §3 makes them a pair — rest and raised
   * — and a raised edge that reads no differently from a resting one is the same bug one step up.
   */
  test("card borders are visible against the page", () => {
    for (const role of ["border", "border2"] as const) {
      const ratio = contrast(color[role], color.bg);
      expect(ratio).not.toBeNull();
      expect(ratio as number).toBeGreaterThanOrEqual(1.2);
    }
    // Raised must read as at least as separated as rest, or the distinction is decorative.
    expect(contrast(color.border2, color.bg) as number).toBeGreaterThanOrEqual(contrast(color.border, color.bg) as number);
  });

  /**
   * The hero scrim, judged against the worst case a PHOTOGRAPH can present: a pure-white pixel.
   *
   * Both themes shipped a scrim tuned by eye and wrong in opposite directions — light a 0.92 white
   * wash that bleached the image and hid the white eyebrow on it, dark a 0.94 black one that erased
   * the image outright. Neither was a legibility requirement; nothing measured what the copy
   * actually needed, so the values drifted to "surely enough".
   *
   * This computes what the copy needs. `heroSide`'s peak stop is composited over #FFFFFF, and the
   * text drawn on it — `inverse`, and `inverse` at the 0.86 opacity the secondary lines use — must
   * clear AA against that composite. It passes at 0.70 and fails below ~0.55, which is what makes it
   * a floor rather than a preference. It also lets the scrim be LOWERED safely: anything that keeps
   * this green keeps the hero readable, and every point below the floor is photograph the user gets
   * back.
   */
  test("the hero scrim keeps its white copy at AA over the brightest possible photo", () => {
    const peak = /rgba\((\d+),(\d+),(\d+),([\d.]+)\)/.exec(gradient.heroSide.colors[0] as string);
    expect(peak).not.toBeNull();
    const [, r, g, b, a] = peak as RegExpExecArray;
    const alpha = Number(a);

    // Photographic scrims are theme-invariant by rule (Decision 24) — assert that, since a
    // per-theme value here is how the bleached light variant existed in the first place.
    expect(gradient.heroSide).toBe(THEMES.dark.gradient.heroSide);
    expect(gradient.heroSide).toBe(THEMES.light.gradient.heroSide);

    // Scrim over a white pixel: the brightest ground the copy can ever land on.
    const over = (channel: number) => Math.round(channel * alpha + 255 * (1 - alpha));
    const hex = (v: number) => v.toString(16).padStart(2, "0");
    const worst = `#${hex(over(Number(r)))}${hex(over(Number(g)))}${hex(over(Number(b)))}`;

    expect(contrast(color.inverse, worst) as number).toBeGreaterThanOrEqual(4.5);

    // Secondary copy (`meta`, `joined`, SlotRing's unit) dims with opacity, which composites the
    // text toward the scrim rather than toward its own colour — so judge the composited ink.
    for (const textOpacity of [0.86, 0.8]) {
      const ink = 255 * textOpacity + over(Number(r)) * (1 - textOpacity);
      const inkHex = `#${hex(Math.round(ink)).repeat(3)}`;
      expect(contrast(inkHex, worst) as number).toBeGreaterThanOrEqual(4.5);
    }
  });
});
