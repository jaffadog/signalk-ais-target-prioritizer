import json from "@rollup/plugin-json";
import svelte from "rollup-plugin-svelte";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

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
    terser({
      compress: {
        defaults: false, // disable all default compressions
        dead_code: true, // remove unreachable code
        unused: true, // remove unused vars/functions
      },
      mangle: false, // keep variable names readable
      format: {
        comments: false, // strip comments
        beautify: true, // keep formatting/newlines
      },
    }),
  ],
  external: [/^node:/, "@signalk/server-api"],
};
