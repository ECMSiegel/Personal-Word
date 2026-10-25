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

test("Zotero refresh in the browser preview says it is desktop-only and never contacts Zotero", async ({ page }) => {
  const zoteroRequests: string[] = [];
  // Strictly offline: any request to the local Zotero address is recorded, then answered with an error.
  await page.route("http://127.0.0.1:23119/**", async (route) => {
    zoteroRequests.push(route.request().url());
    await route.abort();
  });

  await start(page, "Zotero Browser Preview");

  const statusEl = page.locator(".zotero-status");
  await expect(statusEl).toHaveText("Zotero refresh: disabled");

  await page.getByRole("button", { name: "Connect local Zotero" }).click();
  await expect(statusEl).toHaveText("Local Zotero refresh enabled -- not yet contacted.");

  await page.getByRole("button", { name: "Refresh from Zotero" }).click();
  await expect(statusEl).toHaveText("Zotero refresh works in the desktop app only.");
  await expect(page.getByRole("dialog", { name: "Import Zotero sources" })).toHaveCount(0);
  await expect(page.locator(".source-item")).toHaveCount(0);
  expect(zoteroRequests).toEqual([]);

  // Refresh can be tried again and still says the same thing; Disconnect still works.
  await page.getByRole("button", { name: "Refresh from Zotero" }).click();
  await expect(statusEl).toHaveText("Zotero refresh works in the desktop app only.");
  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(statusEl).toHaveText("Disconnected from local Zotero.");
  expect(zoteroRequests).toEqual([]);
});

test("Zotero local refresh explains the required desktop setting", async ({ page }) => {
  await start(page, "Zotero API hint");
  await expect(page.getByText("In Zotero, enable the local API in Settings > Advanced before refreshing.", { exact: true })).toBeVisible();
});
