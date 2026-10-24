import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:1420",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: false,
  },
  reporter: "list",
});
