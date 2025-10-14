import json from "@rollup/plugin-json";

export default {
  input: "plugin/index.js",
  output: {
    file: "plugin/index.cjs",
    // dir: "output",
    format: "cjs",
  },
  plugins: [json()],
  external: ["node:fs"],
};
