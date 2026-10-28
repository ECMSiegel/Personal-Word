import { test, expect, type Page } from "@playwright/test";

// File drops are scoped: the Projects list and each source's PDF slot outline themselves
// while a matching drag is over the window; the page body stays untouched.

const SHOTS = process.env.N4_SHOTS;
const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n%%EOF\n", "ascii");

type DropFile = { name: string; body?: string; size?: number; type?: string };

function transfer(page: Page, files: DropFile[]) {
  return page.evaluateHandle((list) => {
    const data = new DataTransfer();
    for (const f of list) {
      const content = f.size !== undefined ? new Uint8Array(f.size).fill(97) : (f.body ?? "");
      data.items.add(new File([content], f.name, { type: f.type ?? "" }));
    }
    return data;
  }, files);
}

async function create(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
}

async function sourceCard(page: Page, title: string) {
  await page.locator(".group-title").filter({ hasText: /^Research$/ }).click();
  await expect(page.locator(".research-panel")).toBeVisible();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page.getByLabel("Authors", { exact: true }).fill("Ada Example");
  await page.getByLabel("Year", { exact: true }).fill("2026");
  return page.locator(".source-item").filter({ hasText: title });
}

test("the Projects list outlines for a .docx, rejects a .pdf with the reason, and the page body is untouched", async ({ page }) => {
  await page.goto("/");
  const library = page.locator(".library");
  const region = page.locator(".library .drop-target");
  await expect(region.locator(".project-list")).toHaveCount(1);

  const docx = await transfer(page, [{ name: "Chapter.docx" }]);
  await library.dispatchEvent("dragenter", { dataTransfer: docx });
  await expect(region).toHaveAttribute("data-state", "accept");
  await expect(region.locator(".drop-target-label")).toHaveText("Drop to import");
  expect(await region.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("solid");
  expect(await library.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  // No tint: the page keeps its plain paper colour.
  const paper = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--paper)";
    document.body.append(probe);
    const c = getComputedStyle(probe).color;
    probe.remove();
    return c;
  });
  expect(await library.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(paper);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/projects-accept-${process.env.N4_SCHEME ?? "light"}.png` });
  await library.dispatchEvent("dragleave", { dataTransfer: docx });
  await expect(region).not.toHaveAttribute("data-state");

  const pdf = await transfer(page, [{ name: "Paper.pdf", type: "application/pdf" }]);
  await library.dispatchEvent("dragenter", { dataTransfer: pdf });
  await expect(region).toHaveAttribute("data-state", "reject");
  await expect(region.locator(".drop-target-label")).toHaveText(
    "Personal Word can import .txt, .md, .docx, .html or .zip files.",
  );
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/projects-reject-${process.env.N4_SCHEME ?? "light"}.png` });
});

test("a project.json is not taken by the writing importer", async ({ page }) => {
  await page.goto("/");
  const region = page.locator(".library .drop-target");
  const json = await transfer(page, [{ name: "project.json", type: "application/json" }]);
  await page.locator(".library").dispatchEvent("dragenter", { dataTransfer: json });
  await expect(region).toHaveAttribute("data-state", "reject");
});

const IMPORT_NAME = "Import writing (text, Markdown, Word, HTML or a .zip bundle)";

test("the Projects import control is a labelled toolbar button at control height that opens the picker and imports the chosen file", async ({ page }) => {
  await page.goto("/");
  const toolbar = page.locator(".library-toolbar");
  const button = toolbar.getByRole("button", { name: IMPORT_NAME });
  await expect(button).toHaveText("Import writing");
  // No orphan Select files control is left floating in the list region.
  await expect(page.locator(".library .drop-target .select-files")).toHaveCount(0);

  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  const start = (await toolbar.getByRole("button", { name: "Start new project" }).boundingBox())!;
  const height = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.height = "var(--control-height)";
    document.body.append(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h;
  });
  expect(box.height).toBeGreaterThanOrEqual(height);
  // Same row as Start new project, same vertical centre, to its right.
  expect(Math.abs(box.y + box.height / 2 - (start.y + start.height / 2))).toBeLessThanOrEqual(1);
  expect(box.x).toBeGreaterThan(start.x + start.width);

  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/projects-import-${scheme}.png` });
  }

  const chooser = page.waitForEvent("filechooser");
  await button.click();
  await (await chooser).setFiles({ name: "picked.md", mimeType: "text/markdown", buffer: Buffer.from("# Picked\n\nBody") });
  const preview = page.getByRole("dialog", { name: "Import writing" });
  await expect(preview).toContainText("picked.md -- Markdown");
});

test("the Projects import control is reachable by keyboard", async ({ page }) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: IMPORT_NAME });
  await button.focus();
  await expect(button).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Enter");
  await chooser;
});

test("a source's PDF slot outlines for a PDF, rejects a .txt, and a drop attaches the PDF", async ({ page }) => {
  await page.goto("/");
  await create(page, "Drop PDF fixture");
  const source = await sourceCard(page, "Slot source");
  const slot = source.locator(".source-pdf-field .drop-target");
  if (!(await slot.isVisible())) await source.locator(".source-toggle").click();
  await expect(slot).toBeVisible();

  const txt = await transfer(page, [{ name: "notes.txt", type: "text/plain" }]);
  await page.locator(".research-panel").dispatchEvent("dragenter", { dataTransfer: txt });
  await expect(slot).toHaveAttribute("data-state", "reject");
  await expect(slot.locator(".drop-target-label")).toHaveText("Only PDF files can be attached.");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/slot-reject-${process.env.N4_SCHEME ?? "light"}.png` });
  await page.locator(".research-panel").dispatchEvent("dragleave", { dataTransfer: txt });
  await expect(slot).not.toHaveAttribute("data-state");

  const pdf = await transfer(page, [{ name: "source.pdf", type: "application/pdf", body: pdfBytes.toString("latin1") }]);
  await page.locator(".research-panel").dispatchEvent("dragenter", { dataTransfer: pdf });
  await expect(slot).toHaveAttribute("data-state", "accept");
  await expect(slot.locator(".drop-target-label")).toHaveText("Drop to attach");
  // The Projects-style whole-page tint does not exist anywhere in the writing workspace.
  expect(await page.locator("main.workspace").evaluate((el) => getComputedStyle(el).outlineStyle)).toBe("none");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/slot-accept-${process.env.N4_SCHEME ?? "light"}.png` });
  await slot.dispatchEvent("dragover", { dataTransfer: pdf });
  await slot.dispatchEvent("drop", { dataTransfer: pdf });
  await expect(source.getByText("source.pdf", { exact: true })).toBeVisible();
  await expect(
    page.locator('.sidebar [data-group="research"] .entry-main').filter({ hasText: /^source\.pdf$/ }),
  ).toBeVisible();
});

test("a PDF over 25 MB or a second file is refused on drop with a message", async ({ page }) => {
  await page.goto("/");
  await create(page, "Drop refusal fixture");
  const source = await sourceCard(page, "Refusal source");
  const slot = source.locator(".source-pdf-field .drop-target");
  if (!(await slot.isVisible())) await source.locator(".source-toggle").click();
  const big = await transfer(page, [{ name: "big.pdf", type: "application/pdf", size: 25 * 1024 * 1024 + 1 }]);
  await slot.dispatchEvent("dragenter", { dataTransfer: big });
  await expect(slot).toHaveAttribute("data-state", "reject");
  await slot.dispatchEvent("drop", { dataTransfer: big });
  await expect(page.locator(".research-status")).toContainText("PDFs must be 25 MB or smaller.");
  await expect(source.getByText("big.pdf", { exact: true })).toHaveCount(0);

  const two = await transfer(page, [
    { name: "a.pdf", type: "application/pdf", body: pdfBytes.toString("latin1") },
    { name: "b.pdf", type: "application/pdf", body: pdfBytes.toString("latin1") },
  ]);
  await slot.dispatchEvent("drop", { dataTransfer: two });
  await expect(page.locator(".research-status")).toContainText("Attach one PDF at a time.");
});

test("Select files in the PDF slot opens the picker and attaches the chosen PDF", async ({ page }) => {
  await page.goto("/");
  await create(page, "Picker fixture");
  const source = await sourceCard(page, "Picker source");
  const slot = source.locator(".source-pdf-field .drop-target");
  if (!(await slot.isVisible())) await source.locator(".source-toggle").click();
  const chooser = page.waitForEvent("filechooser");
  await slot.getByRole("button", { name: "Select files" }).click();
  await (await chooser).setFiles({ name: "picked.pdf", mimeType: "application/pdf", buffer: pdfBytes });
  await expect(source.getByText("picked.pdf", { exact: true })).toBeVisible();
});
