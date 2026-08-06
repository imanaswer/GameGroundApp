import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Static audit: a centred, truncating `Text` must have a definite width.
 *
 * The bug this closes shipped on CoachCard's compact variant and was reported as "the starting A
 * is not visible". A single-line ellipsised Text, centred inside a column that centres its
 * children, has no width of its own — it is measured from its content, the ellipsis calculation
 * lands a hair wide of the layout width, and an ancestor's `overflow: "hidden"` takes the
 * difference off the LEADING edge. The trailing "…" then makes it read as ordinary truncation, so
 * the missing first letter looks like a font defect rather than a layout one. It is invisible
 * until real data is long enough, invisible to typecheck and lint, and it survived review twice.
 *
 * The rule: if a style sets `textAlign: "center"` and is used by a Text carrying `numberOfLines`,
 * it must also pin a width — `alignSelf: "stretch"`, an explicit `width`/`maxWidth`, `flex: n`, or
 * absolute positioning. Then the text ellipsises INTO a known box and centres inside it.
 *
 * Centred text that WRAPS is deliberately not covered: with no `numberOfLines` it grows downward
 * rather than past its edges, so content-measurement is correct there (EmptyState, ErrorState and
 * Placeholder headlines all rely on it).
 *
 * Like the other audits here this reads source rather than rendering, so it is a floor, not a
 * proof: it resolves styles by name within a file and cannot follow one passed through props. It
 * catches the co-located case, which is where the shipped bug lived.
 */

const SRC_ROOTS = [join(__dirname, "..", "app"), join(__dirname, "..", "src")];

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });

/** `name: { ...body }` entries in a themed()/StyleSheet map. Tolerates one nested object. */
function styleBodies(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of source.matchAll(/(\w+):\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)) out[m[1]] = m[2];
  return out;
}

/** Anything that gives the box a width independent of its own content. */
const DEFINITE =
  /alignSelf:\s*["']stretch["']|width:|flex:\s*[1-9]|maxWidth:|position:\s*["']absolute["']/;

const CENTRED = /textAlign:\s*["']center["']/;

test("centred truncating Text has a definite width", () => {
  const failures: string[] = [];

  for (const file of SRC_ROOTS.flatMap(walk)) {
    const source = readFileSync(file, "utf8");
    const styles = styleBodies(source);

    for (const el of source.matchAll(/<(?:Animated\.)?Text\b([^>]*?)>/gs)) {
      const attrs = el[1];
      if (!/numberOfLines/.test(attrs)) continue;

      for (const ref of attrs.matchAll(/(?:styles|cardStyles|s)\.(\w+)/g)) {
        const body = styles[ref[1]];
        if (!body || !CENTRED.test(body) || DEFINITE.test(body)) continue;
        failures.push(
          `${file.split(/[\\/]/).pop()}: \`${ref[1]}\` centres a truncating Text with no width — ` +
            `add alignSelf: "stretch" (see CoachCard.compactName)`,
        );
      }
    }
  }

  expect(failures).toEqual([]);
});
