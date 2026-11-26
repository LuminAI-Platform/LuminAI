import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lucide-react",
              message:
                "Import icons from src/lib/icons (ICON_MAP / Icons) instead of lucide-react directly.",
            },
            {
              name: "@tabler/icons-react",
              message: "Use the central Lucide icon map in src/lib/icons.",
            },
            {
              name: "@phosphor-icons/react",
              message: "Use the central Lucide icon map in src/lib/icons.",
            },
            {
              name: "react-icons",
              message: "Use the central Lucide icon map in src/lib/icons.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/iconExports.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
]);
