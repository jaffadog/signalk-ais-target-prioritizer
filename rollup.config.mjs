import json from "@rollup/plugin-json";
import { builtinModules } from "node:module";
import pkg from "./package.json" with { type: "json" };
import svelte from "rollup-plugin-svelte";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";

// polyfill for node 18:
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

export default {
  input: "src/plugin/index.svelte.ts",
  output: {
    file: "plugin/index.cjs",
    format: "cjs",
    exports: "auto",
    interop: "auto",
    sourcemap: false,
    // exports: "named",
  },
  plugins: [
    svelte(),
    nodeResolve({
      exportConditions: ["svelte"],
      extensions: [".mjs", ".js", ".ts", ".svelte.js", ".svelte.ts"],
    }),
    commonjs({
      defaultIsModuleExports: "auto",
    }),
    typescript({
      tsconfig: "./tsconfig.plugin.json",
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
    process.env.SKIP_VISUALIZER
      ? null
      : visualizer({
          filename: "stats-plugin.html",
          template: "treemap", // "treemap", "sunburst", "network"
          gzipSize: true,
          brotliSize: true,
        }),
  ],
  external: [
    ...builtinModules,
    ...Object.keys(pkg.dependencies),
    /^node:/,
    "@signalk/server-api",
  ],
};
