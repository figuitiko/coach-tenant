import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  projects: [
    { name: "chromium", testIgnore: /pilot-journeys\.spec\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", testIgnore: /pilot-journeys\.spec\.ts/, use: { ...devices["Pixel 7"] } },
    { name: "pilot-postgres", testMatch: /pilot-journeys\.spec\.ts/, fullyParallel: false, workers: 1, use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: process.env.TEST_DATABASE_URL ? "DATABASE_URL=$TEST_DATABASE_URL pnpm dev" : "pnpm dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
});
