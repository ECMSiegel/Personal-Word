import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import JSZip from "jszip";

// T032 / Gate B finding F1: mid-parse import cancellation from the UI.
// The read is slowed in-page (patched File.arrayBuffer) so the parsing state
// is deterministically observable long enough to cancel it, without any
// production test hook.
const FIXTURES_DIR = path.resolve("tests/fixtures/rich-import");
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// After a cancel the abandoned work may still finish later. There is no
// positive "parse finished" marker in the UI, so after the deterministic
// trigger (slowed read resolved / delayed chunk delivered) we yield the page
// for 1.5 s of event-loop time so that a build that failed to abort has
// time to open the preview. Only then do we assert, before any reload.
const settle = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        let n = 0;
        const tick = () => (++n >= 30 ? resolve() : setTimeout(tick, 50));
        tick();
      }),
  );

test("cancelling a slow import leaves no preview dialog and no project", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return new Promise<void>((resolve) => setTimeout(resolve, 1500)).then(() => {
        (window as unknown as { __readDone?: boolean }).__readDone = true;
        return original.call(this);
      });
    };
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  const before = await page.locator(".project-row").count();

  await page.locator("#import-writing-text").setInputFiles({
    name: "rich-sample.docx",
    mimeType: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });

  // While parsing, an "Importing writing" dialog with a cancel affordance is shown.
  const busy = page.getByRole("dialog", { name: "Importing writing" });
  await expect(busy).toBeVisible();
  await busy.getByRole("button", { name: "Cancel import" }).click();

  // The cancel closes the parsing dialog and never opens the preview dialog.
  await expect(busy).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);

  // Wait past the slowed read's completion (marker set by the patched read),
  // then assert BEFORE any reload that the abandoned import never surfaces a
  // preview dialog or a project. A cancel that does not abort fails here.
  await page.waitForFunction(() => (window as unknown as { __readDone?: boolean }).__readDone === true);
  await settle(page);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);

  // The aborted parse creates nothing, even after a reload.
  await page.reload();
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);
});

test("cancelling while the parser is running inside previewWriting leaves no preview dialog and no project", async ({ page }) => {
  // A .zip import makes previewWriting load the markdown-bundle parser chunk
  // dynamically. Delaying that chunk holds the import INSIDE previewWriting
  // (the file read is already done), so the cancel lands mid-parse.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let chunkRequested!: () => void;
  const requested = new Promise<void>((resolve) => (chunkRequested = resolve));
  let delivered!: () => void;
  const deliveredP = new Promise<void>((resolve) => (delivered = resolve));
  await page.route("**/assets/markdownBundle-*.js", async (route) => {
    chunkRequested();
    await gate;
    await route.continue();
    delivered();
  });

  const zip = new JSZip();
  zip.file("manuscript.md", "# Mid parse\n\nBody text for the cancelled import.\n");
  const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  const before = await page.locator(".project-row").count();

  await page.locator("#import-writing-text").setInputFiles({
    name: "mid-parse.zip",
    mimeType: "application/zip",
    buffer,
  });

  // The parser chunk was requested, so previewWriting is running and waiting on it.
  await requested;
  const busy = page.getByRole("dialog", { name: "Importing writing" });
  await expect(busy).toBeVisible();
  await busy.getByRole("button", { name: "Cancel import" }).click();
  await expect(busy).toHaveCount(0);

  // Let the parser chunk arrive and the parse proceed after the cancel.
  release();
  await deliveredP;
  await settle(page);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);

  await page.reload();
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);
});

test("a completed import still opens the preview dialog (control)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();

  await page.locator("#import-writing-text").setInputFiles({
    name: "rich-sample.docx",
    mimeType: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });

  // Control: not cancelling must still reach the preview (proves the busy
  // state does not swallow normal completion).
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("pressing Escape on the Importing writing dialog cancels a slow import and leaves no preview dialog and no project", async ({ page }) => {
  await page.addInitScript(() => {
    const original = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = function () {
      return new Promise<void>((resolve) => setTimeout(resolve, 1500)).then(() => {
        (window as unknown as { __readDone?: boolean }).__readDone = true;
        return original.call(this);
      });
    };
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  const before = await page.locator(".project-row").count();

  await page.locator("#import-writing-text").setInputFiles({
    name: "rich-sample.docx",
    mimeType: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });

  // Escape (keyboard dismissal, not the Cancel button) while the busy dialog is shown.
  const busy = page.getByRole("dialog", { name: "Importing writing" });
  await expect(busy).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(busy).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);

  await page.waitForFunction(() => (window as unknown as { __readDone?: boolean }).__readDone === true);
  await settle(page);
  await expect(page.getByRole("dialog", { name: "Import writing" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);

  await page.reload();
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);
});

test("pressing Escape on the Import writing preview dialog abandons the import and creates no project", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  const before = await page.locator(".project-row").count();

  await page.locator("#import-writing-text").setInputFiles({
    name: "rich-sample.docx",
    mimeType: DOCX_MIME,
    buffer: fs.readFileSync(path.join(FIXTURES_DIR, "rich-sample.docx")),
  });

  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await settle(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);

  await page.reload();
  await expect(page.getByRole("button", { name: "Start new project" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.locator(".project-row").count()).toBe(before);
});
