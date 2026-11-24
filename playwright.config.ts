import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests run against a live server with a seeded database:
 *   SEED_DEMO=true npm run db:seed && npm run build && npm start
 *   npm run test:e2e
 * Storefronts are reached via <slug>.localhost (Chromium resolves *.localhost to loopback).
 */
export default defineConfig({
  globalSetup: "./tests/e2e/global-setup.ts",
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "off",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
});
