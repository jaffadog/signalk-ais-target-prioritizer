import json from "@rollup/plugin-json";
import svelte from "rollup-plugin-svelte";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/plugin/index.svelte.js",
  output: {
    file: "plugin/index.cjs",
    format: "cjs",
  },
  plugins: [
    svelte(),
    nodeResolve({
      exportConditions: ["svelte"],
      extensions: [".mjs", ".js", ".ts", ".svelte.js", ".svelte.ts"],
      // extensions: [".svelte.js", ".mjs", ".js"],
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      outDir: "plugin",
    }),
    json(),
  ],
  // external: ["node:fs"],
  external: [/^node:/],
};

/*
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";

export default {
  input: "src/plugin/index.mjs",
  output: {
    file: "plugin/index.cjs",
    format: "cjs",
  },
  plugins: [
    json(),
    nodeResolve(),   // only needed if you have bare npm imports in engine code
  ],
  external: [/^node:/],
};
*/
