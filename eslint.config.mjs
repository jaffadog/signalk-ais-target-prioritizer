import prettier from "eslint-config-prettier";
import path from "node:path";
import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import { defineConfig, includeIgnoreFile } from "eslint/config";
import globals from "globals";
import ts from "typescript-eslint";

const gitignorePath = path.resolve(import.meta.dirname, ".gitignore");

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      "no-undef": "off",
      "svelte/no-at-html-tags": "off",
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts", "**/*.svelte.js"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: [".svelte"],
        parser: ts.parser,
      },
    },
  },
  {
    // Override or add rule settings here, such as:
    // 'svelte/button-has-type': 'error'
    rules: {},
  },
);

// import js from "@eslint/js";
// import globals from "globals";
// import prettier from "eslint-config-prettier";
// import svelte from "eslint-plugin-svelte";

// export default [
//   js.configs.recommended,
//   ...svelte.configs["flat/recommended"],
//   prettier,
//   ...svelte.configs["flat/prettier"], // disables svelte rules that conflict with prettier
//   {
//     languageOptions: {
//       globals: {
//         ...globals.browser,
//       },
//     },
//     rules: {
//       "svelte/no-at-html-tags": "off",
//     },
//   },
// ];

// import js from "@eslint/js";
// import globals from "globals";
// import { defineConfig } from "eslint/config";
// import eslintConfigPrettier from "eslint-config-prettier/flat";

// export default defineConfig([
//   {
//     files: ["**/*.{js,mjs,cjs,jsx}"],
//     plugins: { js },
//     extends: ["js/recommended"],
//     languageOptions: {
//       parserOptions: {
//         ecmaFeatures: {
//           jsx: true,
//         },
//       },
//       globals: { ...globals.browser, ...globals.node },
//     },
//   },
//   eslintConfigPrettier,
// ]);
