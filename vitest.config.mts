import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // Next.js keeps JSX as-is ("preserve"); tests need it compiled.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { environment: "node", include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"] },
});
