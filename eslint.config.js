const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

/** Hex literal anywhere in a string: #fff, #050505, #e63946ff. */
const HEX = String.raw`/#[0-9a-fA-F]{3,8}\b/`;

module.exports = defineConfig([
  expoConfig,
  { ignores: ["dist/*", ".expo/*", "node_modules/*"] },

  // Colors live in src/lib/tokens.ts. Screens compose; they never hardcode.
  {
    files: ["app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=${HEX}]`,
          message: "No inline hex colors — import from src/lib/tokens.ts (DESIGN_SYSTEM.md §1).",
        },
        {
          selector: `TemplateElement[value.raw=${HEX}]`,
          message: "No inline hex colors — import from src/lib/tokens.ts (DESIGN_SYSTEM.md §1).",
        },
      ],
    },
  },

  // Every network call goes through src/api/client.ts.
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/api/client.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "No raw fetch — use the wrapper in src/api/client.ts (Developer PRD §4)." },
      ],
    },
  },

  // Nothing security-relevant in AsyncStorage; SecureStore only via src/lib/storage.ts.
  {
    files: ["app/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    ignores: ["src/lib/storage.ts", "src/lib/query-persist.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "expo-secure-store",
              message: "SecureStore is wrapped by src/lib/storage.ts — import that instead (§S1.1).",
            },
            {
              name: "@react-native-async-storage/async-storage",
              message: "AsyncStorage is for the React Query cache only, never for auth state (§S1.1).",
            },
          ],
        },
      ],
    },
  },
]);
