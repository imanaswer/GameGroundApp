import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * The E2E suite selects on testIDs, which are invisible to typecheck and lint — deleting or
 * renaming one is silent until Maestro fails on a device, long after the change lands.
 *
 * This closes that loop in CI: every `id:` the flows reference must exist in the source. It
 * caught `registration-age` (the real entities.ts key is `childAge`) the first time it ran.
 *
 * It asserts the id EXISTS, not that the flow passes — only a device can tell you that.
 */

const MAESTRO_DIR = join(__dirname, "..", ".maestro");
const SRC_GLOBS = [join(__dirname, "..", "app"), join(__dirname, "..", "src")];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
  });
}

function flowFiles(): string[] {
  const top = readdirSync(MAESTRO_DIR, { withFileTypes: true });
  return top.flatMap((e) => {
    const p = join(MAESTRO_DIR, e.name);
    if (e.isDirectory()) return readdirSync(p).map((f) => join(p, f));
    return e.name.endsWith(".yaml") ? [p] : [];
  });
}

/** `id: "foo"` / `id: foo` in a Maestro selector block. */
function referencedIds(yamlText: string): string[] {
  return [...yamlText.matchAll(/^\s*id:\s*"?([A-Za-z0-9_-]+)"?\s*$/gm)].map((m) => m[1]);
}

const source = SRC_GLOBS.flatMap(walk)
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

/** Static `testID="x"` plus the one templated family, `registration-${f.key}`. */
const staticIds = new Set(
  [...source.matchAll(/testID=\{?["'`]([A-Za-z0-9_-]+)["'`]\}?/g)].map((m) => m[1]),
);
const templatedPrefixes = [...source.matchAll(/testID=\{`([a-z-]+)-\$\{/g)].map((m) => m[1]);

function isDefined(id: string): boolean {
  if (staticIds.has(id)) return true;
  return templatedPrefixes.some((p) => id.startsWith(`${p}-`));
}

describe("Maestro selector contract", () => {
  const flows = flowFiles().filter((f) => f.endsWith(".yaml"));

  it("finds the flow files", () => {
    expect(flows.length).toBeGreaterThanOrEqual(6);
  });

  it.each(flows)("%s references only testIDs that exist in source", (file) => {
    const missing = referencedIds(readFileSync(file, "utf8")).filter((id) => !isDefined(id));
    expect(missing).toEqual([]);
  });

  it("the tab ids match the real route names", () => {
    // TabBar builds `tab-${route.name}`, so these must be route names, not labels.
    for (const route of ["home", "games", "coaches", "discover", "leaders"]) {
      expect(isDefined(`tab-${route}`)).toBe(true);
    }
  });

  it("the camp registration ids match entities.ts field keys", () => {
    // Read as text, not imported: entities.ts pulls in the api client, which throws at import
    // time without EXPO_PUBLIC_API_URL. The keys are a flat literal list, so a regex is enough.
    const entities = readFileSync(
      join(__dirname, "..", "src", "features", "registration", "entities.ts"),
      "utf8",
    );
    const campBlock = entities.slice(entities.indexOf('kind: "camp"'), entities.indexOf('kind: "workshop"'));
    const campKeys = [...campBlock.matchAll(/\{\s*key:\s*"([A-Za-z0-9_]+)"/g)].map((m) => m[1]);

    expect(campKeys).toContain("childName"); // guards the slice above still finds the block

    const used = referencedIds(readFileSync(join(MAESTRO_DIR, "03-camp-registration.yaml"), "utf8"))
      .filter((id) => id.startsWith("registration-") && id !== "registration-submit")
      .map((id) => id.replace("registration-", ""));

    expect(used.length).toBeGreaterThan(0);
    for (const key of used) expect(campKeys).toContain(key);
  });
});
