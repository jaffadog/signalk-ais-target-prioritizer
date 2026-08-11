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

  // build: {
  //   outDir: "dist/app",
  // },

  resolve: {
    alias: {},
  },
  optimizeDeps: {
    // maplibre-gl v6 loads its worker as a separate .mjs file; Vite's esbuild
    // pre-bundler doesn't preserve that reference correctly, so the worker
    // 404s and nothing the worker does (tiles, style processing) ever runs.
    exclude: ["maplibre-gl"],
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
});
