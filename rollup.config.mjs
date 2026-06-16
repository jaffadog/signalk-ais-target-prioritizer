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
    }),
    typescript({
      tsconfig: "./tsconfig.json",
      outDir: "plugin",
      sourceMap: false,
    }),
    json(),
  ],
  external: [/^node:/],
};
