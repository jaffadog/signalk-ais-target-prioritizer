import json from "@rollup/plugin-json";
import svelte from "rollup-plugin-svelte";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default {
  input: "src/plugin/index.svelte.ts",
  output: {
    file: "plugin/index.cjs",
    format: "cjs",
    sourcemap: false,
    exports: "named",
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
  external: [/^node:/, "@signalk/server-api"],
};
