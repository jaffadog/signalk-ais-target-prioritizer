import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	root: "src",
	base: "./",
	build: {
		outDir: "../public",
		emptyOutDir: true,
	},
	server: {
		host: true,
		allowedHosts: true,
		proxy: {
			"/plugins": "http://127.0.0.1:3000",
			"/signalk": "http://127.0.0.1:3000",
		},
	},
});
