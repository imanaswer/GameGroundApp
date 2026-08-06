import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { ESLint } from "eslint";

/**
 * M0 exit criterion: the three enforced conventions are proven to fire, not just configured.
 * This replaces the throwaway violating commit — the proof runs in CI on every PR.
 */
const VIOLATIONS = `
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Text } from "react-native";

export default function Probe() {
  fetch("https://www.gameground.net/api/games");
  AsyncStorage.getItem("gg.access");
  SecureStore.getItemAsync("gg.access");
  return <Text style={{ color: "#ff0000" }}>nope</Text>;
}
`;

// Config is required, not discovered: ESLint's on-disk config lookup uses dynamic import,
// which Jest's VM can't do. Same array either way — this is the project's real config.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const config = require("../eslint.config.js") as ESLint.Options["overrideConfig"];

async function lint(code: string, filePath: string) {
  const eslint = new ESLint({ cwd: process.cwd(), overrideConfigFile: true, overrideConfig: config });
  const results = await eslint.lintText(code, { filePath });
  return results[0].messages;
}

jest.setTimeout(30_000);

test("a screen violating all three conventions is rejected", async () => {
  const messages = await lint(VIOLATIONS, "app/probe.tsx");
  const rules = messages.map((m) => m.ruleId);

  // No raw fetch outside src/api/client.ts
  expect(rules).toContain("no-restricted-globals");
  // No SecureStore / AsyncStorage outside their wrappers — one rule, two reported imports
  expect(rules.filter((r) => r === "no-restricted-imports")).toHaveLength(2);
  // No inline hex colors in app/
  expect(rules).toContain("no-restricted-syntax");
});

test("the hex rule catches template literals too", async () => {
  const messages = await lint(
    "export const s = `linear-gradient(#050505, transparent)`;\n",
    "app/probe.tsx",
  );
  expect(messages.map((m) => m.ruleId)).toContain("no-restricted-syntax");
});

test("src/lib/storage.ts is allowed to import expo-secure-store", async () => {
  const messages = await lint(
    'import * as SecureStore from "expo-secure-store";\nexport const k = SecureStore;\n',
    "src/lib/storage.ts",
  );
  expect(messages.map((m) => m.ruleId)).not.toContain("no-restricted-imports");
});

test("src/api/client.ts is allowed to call fetch", async () => {
  const messages = await lint(
    "export const go = () => fetch(\"/api/games\");\n",
    "src/api/client.ts",
  );
  expect(messages.map((m) => m.ruleId)).not.toContain("no-restricted-globals");
});

/**
 * DECISION 20 — every hardcoded `fontSize` must land on a step of the ported scale.
 *
 * Before the port the app carried 43 hardcoded sizes tuned against the old 13px body: 7, 7.5,
 * 8.5, 9, 9.5, 11, 11.5, 12.5, 13, 15, 18, 30. Several sat BELOW the source scale's 10px floor.
 * They were invisible to typecheck and lint, and each one silently opted its component out of the
 * type system — which is exactly how a ported scale rots back into a pile of magic numbers.
 *
 * ESLint cannot express this (it is a value constraint, not a syntax one), so it is asserted here.
 * Prefer a `type.*` role over a raw size; this is the backstop for the cases that genuinely need
 * a one-off, not permission to add them.
 */
test("hardcoded fontSize values stay on the ported type scale", () => {
  const SCALE = new Set([10, 12, 14, 16, 20, 28, 32]);
  const roots = [join(__dirname, "..", "src"), join(__dirname, "..", "app")];

  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
    });

  const offenders: string[] = [];
  for (const file of roots.flatMap(walk)) {
    const text = readFileSync(file, "utf8");
    for (const [, raw] of text.matchAll(/fontSize: ([0-9.]+)/g)) {
      if (!SCALE.has(Number(raw))) offenders.push(`${file.split(/[\/]/).pop()}: ${raw}`);
    }
  }

  expect(offenders).toEqual([]);
});

/**
 * Theming guards (Decision 24). Both failures below are silent: the app compiles, lints, renders,
 * and is simply stuck in whichever palette was active when the module was first imported. Neither
 * is visible until someone switches theme on a device and finds one screen that didn't.
 */
test("module-scope stylesheets that read a token use themed(), not StyleSheet.create", () => {
  const roots = [join(__dirname, "..", "src"), join(__dirname, "..", "app")];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
    });

  const offenders: string[] = [];
  for (const file of roots.flatMap(walk)) {
    const text = readFileSync(file, "utf8");
    // Balanced-brace matching is overkill here: a StyleSheet.create body that mentions a themed
    // token anywhere is already the bug, wherever the braces close.
    for (const [, body] of text.matchAll(/StyleSheet\.create\(\{([\s\S]*?)\n\}\)/g)) {
      if (/\b(?:color|tier|gradient|shadow)\.[a-zA-Z]/.test(body)) {
        offenders.push(file.split(/[\/]/).pop() as string);
      }
    }
  }

  expect(offenders).toEqual([]);
});

test("every themed stylesheet is read through the reactive hook", () => {
  const roots = [join(__dirname, "..", "src"), join(__dirname, "..", "app")];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
    });

  /**
   * `const styles = useThemedStyles(sheets)`, not a module-scope `styles.x` read.
   *
   * Both forms are CURRENT — the proxy always answers with the active palette — but only the hook
   * is REACTIVE, and under the React Compiler that gap is the bug. The compiler treats a
   * module-scope binding as constant, so it caches `[styles.a, styles.b]`, or the JSX holding it,
   * once per component instance and reuses it forever. The component then re-renders on a theme
   * change and hands back its previous-palette output. It surfaced as a switch that applied to
   * some screens and not others: compiled components froze, bailed-out ones updated.
   */
  const offenders = roots
    .flatMap(walk)
    .filter((f) => {
      const text = readFileSync(f, "utf8");
      return text.includes("themed(() =>") && !text.includes("useThemedStyles(");
    })
    .map((f) => f.split(/[\/]/).pop() as string);

  expect(offenders).toEqual([]);
});

/**
 * The same rule for a SHARED sheet — one module's `export const x = themed(...)` read by another.
 *
 * The test above only asks whether a file that declares a themed sheet calls the hook *somewhere*,
 * which is not the same question. Every card file passed it — each has its own local `sheets` and
 * hooks that — while reading `cardStyles.title` straight off the import from `parts.tsx`. The rail
 * titles rendered light's #101828 on the dark ground: near-black on near-black, invisible, and
 * reported from a device rather than by anything here.
 *
 * Comments are stripped first: a doc line that mentions `cardStyles.card` to explain why a local
 * style matches it is exactly the kind of note worth keeping, and it is not a read.
 */
test("a themed stylesheet imported from another module is read through the hook too", () => {
  const roots = [join(__dirname, "..", "src"), join(__dirname, "..", "app")];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = join(dir, e.name);
      return e.isDirectory() ? walk(p) : p.endsWith(".tsx") || p.endsWith(".ts") ? [p] : [];
    });

  const files = roots.flatMap(walk);
  const withoutComments = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  // Every `export const <name> = themed(...)`, and where it is declared.
  const shared = new Map<string, string>();
  for (const file of files)
    for (const [, name] of readFileSync(file, "utf8").matchAll(/export const (\w+) = themed\(/g))
      shared.set(name, file);

  const offenders: string[] = [];
  for (const [name, declaredIn] of shared) {
    for (const file of files) {
      if (file === declaredIn) continue;
      // Remove the legal form, then look for anything left that still reaches into the sheet.
      const body = withoutComments(readFileSync(file, "utf8")).split(`useThemedStyles(${name})`).join("");
      const raw = body.match(new RegExp(`\\b${name}\\.\\w+`, "g"));
      if (raw) offenders.push(`${file.split(/[\/]/).pop()}: ${[...new Set(raw)].join(", ")}`);
    }
  }

  expect(offenders).toEqual([]);
});
