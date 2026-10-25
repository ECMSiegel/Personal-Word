import { expect, test, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

async function start(page: Page, title: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

test("BibTeX file import displays 'Import sources' and loads sources cleanly", async ({ page }) => {
  await start(page, "BibTeX Import Test");

  const sampleBibPath = path.resolve(process.cwd(), "tests/fixtures/sample.bib");
  const sampleBibContent = fs.readFileSync(sampleBibPath, "utf-8");

  const fileInput = page.getByLabel(/Zotero CSL JSON file/);
  await fileInput.setInputFiles({
    name: "sample.bib",
    mimeType: "text/x-bibtex",
    buffer: Buffer.from(sampleBibContent),
  });

  // Verify modal title is "Import sources" (NOT "Import Zotero sources")
  await expect(page.getByRole("dialog", { name: "Import sources" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).not.toBeVisible();

  // Verify review text shows 5 sources to add
  await expect(page.getByText("5 sources to add")).toBeVisible();

  // Add all sources
  await page.getByRole("button", { name: "Add sources", exact: true }).click();

  // Verify modal closes and 5 sources appear in list
  await expect(page.locator(".source-item")).toHaveCount(5);
  await expect(page.locator(".source-item").filter({ hasText: "The TeXbook" })).toBeVisible();
  await expect(page.locator(".source-item").filter({ hasText: "A Mathematical Theory of Communication" })).toBeVisible();
});

test("Zotero localhost refresh operates offline with mock route and protects local sources", async ({ page }) => {
  let requests = 0;
  // Mock Zotero local API route (strictly offline, zero external network calls)
  await page.route("http://127.0.0.1:23119/api/**", async (route) => {
    requests += 1;
    const jsonResponse = [
      {
        id: "ZOTERO_REFRESH_1",
        type: "book",
        title: "Synthetic Zotero Item",
        author: [{ family: "Localhost", given: "Tester" }],
        issued: { "date-parts": [[2026]] },
      },
    ];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Last-Modified-Version": "100",
        "Total-Results": "1",
      },
      body: JSON.stringify(jsonResponse),
    });
  });

  await start(page, "Zotero Localhost Refresh");

  // Verify default state: Zotero refresh is disabled / disconnected
  const statusEl = page.locator(".zotero-status");
  await expect(statusEl).toBeVisible();
  await expect(statusEl).toHaveText("Zotero refresh: disabled");

  // Connect local Zotero
  const connectBtn = page.getByRole("button", { name: "Connect local Zotero" });
  await expect(connectBtn).toBeVisible();
  await connectBtn.click();

  await expect(statusEl).toHaveText("Local Zotero refresh enabled -- not yet contacted.");
  expect(requests).toBe(0);

  // Refresh from Zotero
  const refreshBtn = page.getByRole("button", { name: "Refresh from Zotero" });
  await expect(refreshBtn).toBeVisible();
  await refreshBtn.click();

  // Expect import review modal to open with the fetched items
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toBeVisible();
  await expect(statusEl).toHaveText("Connected to local Zotero -- received 1 item.");
  expect(requests).toBeGreaterThan(0);
  await expect(page.getByText("1 sources to add")).toBeVisible();
  await expect(page.getByText("Add Synthetic Zotero Item")).toBeVisible();

  // Add the source
  await page.getByRole("button", { name: "Add sources", exact: true }).click();
  await expect(page.locator(".source-item")).toHaveCount(1);
  await expect(page.locator(".source-item").filter({ hasText: "Synthetic Zotero Item" })).toBeVisible();

  // Disconnect
  const disconnectBtn = page.getByRole("button", { name: "Disconnect" });
  await expect(disconnectBtn).toBeVisible();
  await disconnectBtn.click();

  await expect(statusEl).toHaveText("Disconnected from local Zotero.");
  // Local source is preserved offline
  await expect(page.locator(".source-item")).toHaveCount(1);
});

test("Zotero refresh follows the next-page link and imports every page", async ({ page }) => {
  const requested: string[] = [];
  await page.route("http://127.0.0.1:23119/api/**", async (route) => {
    const url = new URL(route.request().url());
    requested.push(url.search);
    const second = url.searchParams.get("start") === "1";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        // Cross-origin: the page can only read these headers if the server exposes them.
        "Access-Control-Expose-Headers": "Link, Total-Results, Last-Modified-Version",
        "Last-Modified-Version": "100",
        "Total-Results": "2",
        ...(second ? {} : { Link: '<http://127.0.0.1:23119/api/users/0/items?start=1>; rel="next"' }),
      },
      body: JSON.stringify([
        second
          ? { id: "PAGE_TWO", type: "book", title: "Second Page Item" }
          : { id: "PAGE_ONE", type: "book", title: "First Page Item" },
      ]),
    });
  });

  await start(page, "Zotero Pagination");
  await page.getByRole("button", { name: "Connect local Zotero" }).click();
  await page.getByRole("button", { name: "Refresh from Zotero" }).click();

  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toBeVisible();
  await expect(page.getByText("2 sources to add")).toBeVisible();
  await expect(page.getByText("Add First Page Item")).toBeVisible();
  await expect(page.getByText("Add Second Page Item")).toBeVisible();
  expect(requested.filter((search) => search.includes("format=csljson"))).toHaveLength(2);
});

test("Zotero refresh stops with a message instead of showing part of the library", async ({ page }) => {
  await page.route("http://127.0.0.1:23119/api/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Access-Control-Expose-Headers": "Link, Total-Results, Last-Modified-Version",
        "Last-Modified-Version": "100",
        "Total-Results": "5",
      },
      body: JSON.stringify([{ id: "ONLY_ONE", type: "book", title: "Only Item Sent" }]),
    });
  });

  await start(page, "Zotero Truncation");
  await page.getByRole("button", { name: "Connect local Zotero" }).click();
  await page.getByRole("button", { name: "Refresh from Zotero" }).click();

  await expect(page.locator(".zotero-status")).toContainText("only part of your Zotero library arrived");
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toHaveCount(0);
  await expect(page.locator(".source-item")).toHaveCount(0);
});

test("Zotero local refresh explains the required desktop setting", async ({ page }) => {
  await start(page, "Zotero API hint");
  await expect(page.getByText("In Zotero, enable the local API in Settings > Advanced before refreshing.", { exact: true })).toBeVisible();
});
