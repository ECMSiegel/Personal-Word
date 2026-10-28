import { expect, test, type Page } from "@playwright/test";

const pdfBytes = Buffer.from(
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n",
  "ascii",
);

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function openResearch(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
}

async function addSource(page: Page, title: string) {
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Year", { exact: true }).fill("2026");
  return page.locator(".source-item").filter({ hasText: title });
}

test("a source PDF opens beside its section and survives reload", async ({ page }) => {
  const externalRequests: string[] = [];
  await page.goto("/");
  const appOrigin = new URL(page.url()).origin;
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== appOrigin)
      externalRequests.push(request.url());
  });
  await create(page, "PDF source");
  await openResearch(page);
  const source = await addSource(page, "A local source");
  await source
    .locator('input[type="file"][accept="application/pdf,.pdf"]')
    .setInputFiles({
      name: "source.pdf",
      mimeType: "application/pdf",
      buffer: pdfBytes,
    });

  await expect(source.getByText("source.pdf", { exact: true })).toBeVisible();
  const sidebarPdf = page
    .locator('.sidebar [data-group="research"] .entry-main')
    .filter({ hasText: /^source\.pdf$/ });
  await expect(sidebarPdf).toBeVisible();
  await source.getByRole("button", { name: "Open beside" }).click();
  const frame = page.locator('iframe[title="PDF: source.pdf"]');
  await expect(frame).toBeVisible();
  let blobUrl = await frame.getAttribute("src");
  expect(blobUrl).toMatch(/^blob:/);
  let byteLength = await page.evaluate(async (url) =>
    (await (await fetch(url)).arrayBuffer()).byteLength, blobUrl,
  );
  expect(byteLength).toBe(pdfBytes.length);
  await expect(page.locator('[data-side="left"]')).toHaveAttribute("data-focused", "");

  await expect(page.locator(".save-status")).toHaveText("Saved", { timeout: 10_000 });
  await page.reload();
  await page.locator(".project-row").filter({ hasText: "PDF source" }).locator("button").first().click();
  await expect(page.locator('iframe[title="PDF: source.pdf"]')).toBeVisible();
  blobUrl = await page.locator('iframe[title="PDF: source.pdf"]').getAttribute("src");
  expect(blobUrl).toMatch(/^blob:/);
  byteLength = await page.evaluate(async (url) =>
    (await (await fetch(url)).arrayBuffer()).byteLength, blobUrl,
  );
  expect(byteLength).toBe(pdfBytes.length);

  await page.getByRole("button", { name: "Close right pane" }).click();
  await sidebarPdf.click();
  await expect(page.locator('iframe[title="PDF: source.pdf"]')).toBeVisible();
  await page.getByRole("button", { name: "Close right pane" }).click();
  await openResearch(page);
  await source.locator(".source-toggle").click();
  await page.getByRole("button", { name: "Remove PDF" }).click();
  await expect(page.locator('.sidebar [data-group="research"] .entry-main').filter({ hasText: /^source\.pdf$/ })).toHaveCount(0);
  expect(externalRequests).toEqual([]);
});

test("source PDFs reject non-PDF bytes and files over 25 MB", async ({ page }) => {
  await page.goto("/");
  await create(page, "PDF validation");
  await openResearch(page);
  const source = await addSource(page, "Validation source");
  const input = source.locator('input[type="file"][accept="application/pdf,.pdf"]');
  await input.setInputFiles({
    name: "not-really.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a PDF"),
  });
  await expect(page.getByRole("alert")).toContainText("Choose a PDF file.");
  await expect(source.getByText("not-really.pdf", { exact: true })).toHaveCount(0);

  const tooLarge = Buffer.alloc(25 * 1024 * 1024 + 1, 0x20);
  Buffer.from("%PDF-1.4", "ascii").copy(tooLarge);
  await input.setInputFiles({
    name: "too-large.pdf",
    mimeType: "application/pdf",
    buffer: tooLarge,
  });
  await expect(page.getByRole("alert")).toContainText("PDFs must be 25 MB or smaller.");
  await expect(source.getByText("too-large.pdf", { exact: true })).toHaveCount(0);
});
