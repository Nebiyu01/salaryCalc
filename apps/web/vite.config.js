import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume the shared package's TypeScript source directly so Vite/esbuild
      // reads its ESM named exports (the compiled CJS dist is for the backend).
      "@salary-calc/shared": fileURLToPath(
        new URL("../../packages/shared/src/index.ts", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    // Don't pre-bundle the shared package: it must resolve through the alias
    // above to its TS source. Pre-bundling caches the CJS dist instead, whose
    // named exports ESM can't read (blank page on `projectRetirement` import).
    exclude: ["@salary-calc/shared"],
  },
});
