import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	root: "src",
	base: "./",
	build: {
		outDir: "../public",
		emptyOutDir: true,
	},
});
