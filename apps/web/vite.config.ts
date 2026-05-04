import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(here, "src"),
    },
  },
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: resolve(here, "index.html"),
    },
  },
});
