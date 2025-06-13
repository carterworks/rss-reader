import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	site: "https://carterworks.github.io/",
	base: "rss-reader",
	trailingSlash: "never",
	output: "static",
	vite: {
		plugins: [tailwindcss()],
	},
});
