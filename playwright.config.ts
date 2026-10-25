import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "1420";
const isPreview = process.env.PLAYWRIGHT_PREVIEW === "1";
const command = isPreview
  ? `npm run preview -- --port ${port} --strictPort`
  : `npm run dev -- --port ${port}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
  reporter: "list",
});

