import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:1420", headless: true },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:1420",
    reuseExistingServer: true,
  },
  reporter: "list",
});
