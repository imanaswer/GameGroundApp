import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { color, gray, ramp, tier } from "@/lib/tokens";

/**
 * Static audit: any StyleSheet entry that sets BOTH a fill and a text colour must be legible.
 *
 * The light port produced fourteen bugs of exactly one shape — a fill inverted to dark while the
 * label sitting on it stayed dark, or vice versa. Invisible text, a 2.2:1 price, a notification
 * wearing an error tint. Every one was invisible to typecheck and lint, and each was found by a
 * human reading for the pattern, which does not scale and does not survive the next contributor.
 *
 * This resolves token references in the same object literal and asserts the pair. It is
 * necessarily incomplete — it cannot see a label whose colour is set in a sibling style, or a
 * fill applied conditionally — so it is a floor, not a proof. It catches the co-located case,
 * which is where all fourteen lived.
 */

const TOKENS: Record<string, string> = {};
for (const [k, v] of Object.entries(color)) if (typeof v === "string") TOKENS[`color.${k}`] = v;
for (const [k, v] of Object.entries(gray)) TOKENS[`gray[${k}]`] = v;
for (const [name, steps] of Object.entries(ramp))
  for (const [step, v] of Object.entries(steps)) TOKENS[`ramp.${name}[${step}]`] = v;
for (const [name, t] of Object.entries(tier)) {
  TOKENS[`tier.${name}.fg`] = t.fg;
  TOKENS[`tierMap.${name}.fg`] = t.fg;
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

test("co-located fill + text colours in StyleSheets meet WCAG AA", () => {
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
