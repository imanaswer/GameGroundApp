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
