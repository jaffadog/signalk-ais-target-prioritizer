import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
  publicDir: "public",
  build: {
    outDir: "dist/app",
  },
  resolve: {
    alias: {},
  },
  server: {
    host: true,
    allowedHosts: true,
    proxy: {
      "/plugins": "http://127.0.0.1:3000",
      "/signalk": {
        target: "http://127.0.0.1:3000",
        ws: true,
      },
    },
  },
});
