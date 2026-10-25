import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";

// T008 production-preview acceptance. These cases drive the app's real
// bundled path -- ProjectLibrary file input -> App.importWriting ->
// previewWriting (docx/html importers in the production bundle) ->
// ImportPreview modal -> confirmImport/createProjectWithAssets -- instead of
// dev-server-only page.evaluate imports of /src/*.ts, which do not exist in
// the built preview. Recorded fail-first (browser-pass1.log): the previous
// /src import form failed 4/5 cases on the production preview.
const FIXTURES_DIR = path.resolve("tests/fixtures/rich-import");
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// setInputFiles drives the same input the user's "Choose writing…" label
// activates (the hidden input's label intercepts raw clicks, and a
// filechooser event requires a real native dialog), exercising the exact
// onChange -> App.importWriting -> previewWriting bundled path.
async function chooseImportFile(page: any, { name, mime, buffer }: { name: string; mime: string; buffer: Buffer }) {
  await page.locator("#import-writing-text").setInputFiles({ name, mimeType: mime, buffer });
}

test("file picker accept attribute includes .docx, .html, and .htm", async ({ page }) => {
  await page.goto("/");
  const picker = page.locator("#import-writing-text");
  const accept = await picker.getAttribute("accept");
  expect(accept).toContain(".docx");
  expect(accept).toContain(".html");
  expect(accept).toContain(".htm");
  expect(accept).toContain(DOCX_MIME);
});

test("DOCX import extracts rich structure, counts, and assets in Chromium (production preview)", async ({ page }) => {
  await page.goto("/");

  await chooseImportFile(page, {
    name: "rich-sample.docx",
    mime: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });

  // The import preview modal is the production preview-side of previewDocx.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("rich-sample.docx -- DOCX");
  const pills = page.locator(".count-pill");
  await expect(pills.filter({ hasText: "1 table" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 image" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 note" })).toHaveCount(1);
  const previewText = page.locator('pre[aria-label="Writing preview"]');
  await expect(previewText).toContainText("Bold");
  await expect(previewText).toContainText("Sample Heading 1");
});

test("HTML import neutralizes malicious scripts and never fetches remote media", async ({ page }) => {
  let remoteRequests = 0;
  page.on("request", (req) => {
    if (req.url().startsWith("https://example.invalid")) {
      remoteRequests++;
    }
  });

  await page.goto("/");

  await chooseImportFile(page, {
    name: "malicious.html",
    mime: "text/html",
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "malicious.html")),
  });

  // The modal only ever renders text; scripts do not run from content.
  await expect(page.getByRole("dialog")).toBeVisible();
  const isPwned = await page.evaluate(() => (window as any).__pwned);
  expect(isPwned).toBeUndefined();
  expect(remoteRequests).toBe(0);

  const warnings = page.locator(".import-warnings");
  await expect(warnings).toContainText("Active content");
  await expect(warnings).toContainText("Remote image");

  const previewText = page.locator('pre[aria-label="Writing preview"]');
  await expect(previewText).toContainText("Safe paragraph text");
});

test("Import preview modal displays content count pills and warnings", async ({ page }) => {
  await page.goto("/");

  await chooseImportFile(page, {
    name: "rich-sample.html",
    mime: "text/html",
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.html")),
  });

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const pills = dialog.locator(".count-pill");
  await expect(pills.filter({ hasText: "paragraph" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 table" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 image" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 note" })).toHaveCount(1);
});

test("Cancellation safety: invalid or aborted import leaves zero persistent projects", async ({ page }) => {
  await page.goto("/");

  const countBefore = await page.locator(".project-row").count();

  // Importing an encrypted DOCX fails in the preview and the error is
  // surfaced by the app; no project is created and no import modal opens.
  await chooseImportFile(page, {
    name: "encrypted.docx",
    mime: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "encrypted.docx")),
  });
  await expect(page.locator(".error-banner")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  let countAfter = await page.locator(".project-row").count();
  expect(countAfter).toBe(countBefore);

  // Aborting a valid import (Cancel on the preview modal) also creates no
  // project: the draft is discarded before any storage call.
  await chooseImportFile(page, {
    name: "rich-sample.docx",
    mime: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  countAfter = await page.locator(".project-row").count();
  expect(countAfter).toBe(countBefore);
});

// Gate B F4 (T035): a DOCX whose picture relationship is TargetMode="External"
// (https://example.invalid/remote.png) and whose body also has an external
// hyperlink. The importer must warn, never fetch, and keep the remote URL out
// of the editor, both while previewing and after the import is confirmed.
function watchOffOrigin(page: Page, origin: string): string[] {
  const off: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:") || u === "about:blank") return;
    off.push(u);
  });
  return off;
}

test("DOCX with an External image relationship warns, makes no off-origin request, and keeps the remote URL out of the editor", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await page.goto("/");

  await chooseImportFile(page, {
    name: "external-image.docx",
    mime: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "external-image.docx")),
  });

  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".import-warnings")).toContainText("External image reference (https://example.invalid/remote.png) was omitted");
  // Nothing was staged: no image pill, no asset.
  await expect(dialog.locator(".count-pill").filter({ hasText: /image/ })).toHaveCount(0);
  // Give a would-be fetch time to show up before asserting silence.
  await page.waitForTimeout(1500);
  expect(off).toEqual([]);

  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toContainText("Sample Heading 1");
  await page.waitForTimeout(1500);

  expect(off).toEqual([]);
  expect(await editor.innerHTML()).not.toMatch(/example\.invalid/);
  // (ProseMirror adds its own empty placeholder <img>, so count image figures, not <img>.)
  await expect(editor.locator("figure.doc-image")).toHaveCount(0);
  // The external hyperlink is kept as a link (it is only a link; it is never fetched).
  await expect(editor.locator("a", { hasText: "External link text" })).toHaveAttribute("href", "https://example.com");
});

test("External-image case: the off-origin watcher is live (an in-page request is counted)", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await page.goto("/");
  await page.evaluate(() => {
    void fetch("https://example.invalid/leak.png", { mode: "no-cors" }).catch(() => undefined);
  });
  await expect.poll(() => off.length).toBe(1);
});
