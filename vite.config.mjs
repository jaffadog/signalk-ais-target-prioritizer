import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(), // <-- Must come after Tailwind
  ],
  // root: "src/web",
  base: "./",
  build: {
    outDir: "public",
    // emptyOutDir: true,
  },

  publicDir: "src/app/public",

  // maplibre creates its worker with { type: "module" }, so the emitted worker
  // has to be an es module rather than vite's default iife
  worker: {
    format: "es",
  },

  // build: {
  //   outDir: "dist/app",
  // },

  resolve: {
    alias: {},
    // component tests mount into jsdom, so svelte has to resolve to its client
    // build rather than the server one. scoped to vitest so the app build and the
    // dev server are unaffected.
    ...(process.env.VITEST ? { conditions: ["browser"] } : {}),
  },
  optimizeDeps: {
    // maplibre-gl v6 loads its worker as a separate .mjs file; Vite's esbuild
    // pre-bundler doesn't preserve that reference correctly, so the worker
    // 404s and nothing the worker does (tiles, style processing) ever runs.
    exclude: ["maplibre-gl"],
  },
  test: {
    setupFiles: ["./test/setup.ts"],
    coverage: {
      // istanbul instruments the source; the v8 provider loses track of files
      // once vite has transformed them and silently omits them from the report
      provider: "istanbul",
      // measure the source, not plugin/index.cjs - the built bundle is what
      // plugin.test.mjs loads, and reporting on it just dilutes the numbers
      include: ["src/**/*.{ts,svelte}"],
      exclude: ["src/**/*.d.ts"],
      // the terminal table omits fully covered files, so emit a summary as well -
      // otherwise a module at 100% looks like one that was never measured
      reporter: ["text", "json-summary"],
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/plugins": "http://127.0.0.1:3000",
      "/skServer": "http://127.0.0.1:3000",
      "/signalk": {
        target: "http://127.0.0.1:3000",
        ws: true,
      },
    },
  },
  // the same proxy for `vite preview`, so the built output can be checked against
  // a real signal k server. without it preview cannot get past the loading screen,
  // and a production-only failure (the maplibre worker not being emitted) looks
  // indistinguishable from "no backend data".
  preview: {
    proxy: {
      "/plugins": "http://127.0.0.1:3000",
      "/skServer": "http://127.0.0.1:3000",
      "/signalk": {
        target: "http://127.0.0.1:3000",
        ws: true,
      },
    },
  },
});
