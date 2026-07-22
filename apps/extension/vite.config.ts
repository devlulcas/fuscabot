import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "src",
  plugins: [react()],
  publicDir: "../public",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "side-panel": "src/side-panel/index.html",
        "service-worker": "src/service-worker.ts",
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "service-worker"
            ? "service-worker.js"
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./side-panel/test-setup.ts"],
    globals: true,
    pool: "forks",
    maxWorkers: 1,
  },
});
