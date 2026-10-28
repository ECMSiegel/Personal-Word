import { test, expect, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import JSZip from "jszip";

// T010 / WP7 production-preview acceptance for the Markdown bundle.
//
// The export half is driven through the real bundled UI: writing-import input ->
// ImportPreview modal -> editor -> "Insert image" -> Settings ->
// "Markdown with images (.zip)" -> a real browser download.
//
// The import half is exercised two ways: directly against the production
// build's own markdownBundle chunk (dist/assets/markdownBundle-*.js, the exact
// code ExportPanel lazy-loads) inside the page, and through the writing-import
// input (previewWriting -> importMarkdownBundle -> ImportPreview). No /src
// dev-server URL is used anywhere, so this runs on `vite preview` of the
// built bundle.
const DIST_ASSETS = path.resolve(process.env.PW_DIST_DIR ?? "dist", "assets");
function bundleChunkUrl(): string {
  const file = fs
    .readdirSync(DIST_ASSETS)
    .find((f) => /^markdownBundle-.*\.js$/.test(f));
  if (!file) throw new Error("dist/assets/markdownBundle-*.js missing; run npm run build first");
  return `/assets/${file}`;
}

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC";
const PNG = Buffer.from(PNG_BASE64, "base64");
const PNG_SHA = createHash("sha256").update(PNG).digest("hex");

const SOURCE_MD = [
  "# Bundle Source",
  "",
  "First sentence with a note[^a] and more text.",
  "",
  "Closing paragraph with second note[^b].",
  "",
  "[^a]: Paragraph one of note A.",
  "",
  "    Paragraph two of note A.",
  "",
  "[^b]: Single note B.",
  "",
].join("\n");

const NOTE_A = "Paragraph one of note A.\n\nParagraph two of note A.";

// Collects every request that left the preview origin (anything that is not
// the page's own origin, data: or blob:).
function watchOffOrigin(page: Page, origin: string): string[] {
  const off: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith(origin) || u.startsWith("data:") || u.startsWith("blob:") || u === "about:blank") return;
    off.push(u);
  });
  return off;
}

async function createBlankProject(page: Page, title: string) {
  await page.getByRole("button", { name: "Start new project" }).click();
  await page.getByRole("button", { name: "Blank", exact: true }).click();
  await page.getByLabel("Project title").fill(title);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
}

async function toolbarButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) {
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
  }
  await expect(button).toBeVisible();
  return button;
}

async function insertTable(page: Page) {
  await (await toolbarButton(page, "Insert table")).click();
}

// Real UI: import SOURCE_MD through the writing-import input, confirm the
// preview, then insert a PNG with the toolbar's "Insert image".
async function buildRichProject(page: Page) {
  await page.addInitScript(() => localStorage.setItem("personal-word.restoreTabs", "true"));
  await page.goto("/");
  await page.locator("#import-writing-text").setInputFiles({
    name: "bundle-source.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(SOURCE_MD, "utf8"),
  });
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Import" }).click();
  await expect(dialog).toHaveCount(0);

  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("Closing paragraph with second note");

  // The Markdown importer keeps tables as text, so build the table in the
  // editor: caret at the end of the first paragraph, "Insert table", type cells.
  await editor.getByText("First sentence with a note").click();
  await page.keyboard.press("End");
  await insertTable(page);
  const table = editor.locator("table");
  await expect(table).toBeVisible();
  for (const [i, cell] of ["Col A", "Col B", "Col C", "Data 1", "Data 2", "Data 3"].entries()) {
    if (i > 0) await page.keyboard.press("Tab");
    await page.keyboard.type(cell);
  }
  await expect(table.locator("th").first()).toHaveText("Col A");
  await expect(table.locator("td").nth(2)).toHaveText("Data 3");

  // Park the caret in the closing paragraph, then insert the image.
  await editor.getByText("Closing paragraph with second note").click();
  await page.keyboard.press("End");
  const chooser = page.waitForEvent("filechooser");
  await (await toolbarButton(page, "Insert image")).click();
  await (await chooser).setFiles({ name: "figure.png", mimeType: "image/png", buffer: PNG });
  const alt = page.locator('input[aria-label="Image alternative text"]');
  await expect(alt).toBeVisible();
  await alt.fill("Figure one");
  await alt.press("Enter");
  await expect(editor.locator("figure.doc-image")).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved");
}

async function openExportSection(page: Page) {
  await page.locator(".group-title").filter({ hasText: /^Settings$/ }).click();
  const section = page.locator(".settings-section", { hasText: "Export document" });
  await expect(section).toBeVisible();
  return section;
}

async function exportBundle(page: Page): Promise<{ bytes: Buffer; filename: string }> {
  const section = await openExportSection(page);
  const download = page.waitForEvent("download");
  await section.getByRole("button", { name: "Markdown with images (.zip)" }).click();
  const d = await download;
  const file = await d.path();
  await expect(page.locator(".settings-status")).toContainText("Markdown bundle exported.");
  return { bytes: fs.readFileSync(file), filename: d.suggestedFilename() };
}

// Re-import bundle bytes with the production chunk, inside the page.
async function importWithChunk(page: Page, bytes: Buffer | Uint8Array, name: string) {
  const chunk = bundleChunkUrl();
  return page.evaluate(
    async ({ b64, name, chunk }) => {
      const mod = await import(/* @vite-ignore */ chunk);
      const raw = atob(b64);
      const arr = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
      try {
        const draft = await mod.importMarkdownBundle(arr, name);
        return { ok: true as const, draft: JSON.parse(JSON.stringify({ ...draft, assets: draft.assets.map((a: any) => ({ id: a.id, meta: a.meta, len: a.bytes.length })) })) };
      } catch (e: any) {
        return { ok: false as const, message: String(e?.message ?? e) };
      }
    },
    { b64: Buffer.from(bytes).toString("base64"), name, chunk },
  );
}

// Flatten a ProseMirror JSON paragraph into ["text", "<ref:id>", ...] tokens.
function inlineShape(node: any): string[] {
  const out: string[] = [];
  for (const c of node.content ?? []) {
    if (c.type === "text") out.push(c.text);
    else if (c.type === "footnoteReference") out.push(`<ref:${c.attrs.id}>`);
  }
  return out;
}

test("ExportPanel offers 'Markdown with images (.zip)' and the preview serves the bundled chunk", async ({ page }) => {
  await page.goto("/");
  await createBlankProject(page, "E2E Bundle UI Test");
  const section = await openExportSection(page);
  const button = section.getByRole("button", { name: "Markdown with images (.zip)" });
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  // The chunk the UI lazy-loads is really served by the production preview.
  const res = await page.request.get(bundleChunkUrl());
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("importMarkdownBundle");
});

test("UI export -> real download -> re-import keeps image, table, multi-paragraph notes, reference positions, manifest hashes; zero off-origin requests", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await buildRichProject(page);
  const { bytes, filename } = await exportBundle(page);
  expect(filename).toBe("bundle-source-markdown.zip");

  // --- inspect the real downloaded archive in Node ---
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).sort();
  expect(names).toEqual(["assets/" + PNG_SHA + ".png", "manifest.json", "manuscript.md"].sort());

  const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
  expect(manifest.format).toBe("personal-word-markdown-bundle");
  expect(manifest.version).toBe(1);
  expect(manifest.title).toBe("bundle-source");
  expect(manifest.assets).toHaveLength(1);
  const entryBytes = Buffer.from(await zip.file(manifest.assets[0].path)!.async("uint8array"));
  expect(manifest.assets[0]).toMatchObject({
    id: PNG_SHA,
    path: `assets/${PNG_SHA}.png`,
    mime: "image/png",
    byteLength: PNG.length,
    width: 1,
    height: 1,
  });
  expect(createHash("sha256").update(entryBytes).digest("hex")).toBe(manifest.assets[0].id);
  expect(entryBytes.equals(PNG)).toBe(true);

  const md = await zip.file("manuscript.md")!.async("string");
  expect(md).toContain(`![Figure one](assets/${PNG_SHA}.png)`);
  expect(md).toMatch(/\| Col A \| Col B \| Col C \|/);
  expect(md).toMatch(/\| Data 1 \| Data 2 \| Data 3 \|/);
  expect(md).toMatch(/\[\^1\]: Paragraph one of note A\.\n\n {4}Paragraph two of note A\./);
  expect(md).toContain("[^2]: Single note B.");

  // --- re-import (production chunk) ---
  const r = await importWithChunk(page, bytes, filename);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  const d = r.draft;
  expect(d.format).toBe("Markdown bundle");
  expect(d.project.title).toBe("bundle-source");
  expect(d.counts).toMatchObject({ images: 1, tables: 1, notes: 2 });
  expect(d.assets).toHaveLength(1);
  expect(d.assets[0].id).toBe(PNG_SHA);
  expect(d.assets[0].len).toBe(PNG.length);

  const doc = d.project.entries[0].content;
  const types = doc.content.map((n: any) => n.type);
  expect(types).toContain("table");
  expect(types).toContain("image");
  const image = doc.content.find((n: any) => n.type === "image");
  expect(image.attrs.assetId).toBe(PNG_SHA);
  expect(image.attrs.alt).toBe("Figure one");

  const notes = d.project.research.footnotes;
  expect(notes).toHaveLength(2);
  expect(notes[0].text).toBe(NOTE_A);
  expect(notes[1].text).toBe("Single note B.");
  const [idA, idB] = [notes[0].id, notes[1].id];
  const shapes = doc.content.filter((n: any) => n.type === "paragraph").map(inlineShape);
  expect(shapes).toContainEqual(["First sentence with a note", `<ref:${idA}>`, " and more text."]);
  expect(shapes.some((s: string[]) => s[0].startsWith("Closing paragraph with second note") && s.includes(`<ref:${idB}>`))).toBe(true);
  const cellText = JSON.stringify(doc.content.find((n: any) => n.type === "table"));
  for (const t of ["Col A", "Col B", "Col C", "Data 1", "Data 2", "Data 3"]) expect(cellText).toContain(t);

  await page.waitForTimeout(500);
  expect(off).toEqual([]);
});

test("bundle download name is filesystem-safe for a title with path characters", async ({ page }) => {
  // Record the exact name ExportPanel hands to the download anchor / save dialog.
  await page.addInitScript(() => {
    (window as any).__downloadNames = [];
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) (window as any).__downloadNames.push(this.download);
      return click.call(this);
    };
  });
  await page.goto("/");
  await createBlankProject(page, "A/B: C?");
  const section = await openExportSection(page);
  await section.getByRole("button", { name: "Markdown with images (.zip)" }).click();
  await expect(page.locator(".settings-status")).toContainText("Markdown bundle exported.");
  const names: string[] = await page.evaluate(() => (window as any).__downloadNames);
  expect(names).toHaveLength(1);
  expect(names[0]).toMatch(/-markdown\.zip$/);
  expect(names[0]).not.toMatch(/[\\/:*?"<>|]/);
});

test("missing asset at export: visible actionable error, no download, no file", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await buildRichProject(page);
  // Remove the stored image bytes from the isolated browser asset store.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("personal-word-browser-assets", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const store = db.objectStoreNames[0];
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  let downloads = 0;
  page.on("download", () => downloads++);
  const section = await openExportSection(page);
  await section.getByRole("button", { name: "Markdown with images (.zip)" }).click();
  const status = page.locator(".settings-status");
  await expect(status).toContainText("An image is missing from this export");
  await expect(status).toContainText(PNG_SHA.slice(0, 12));
  await expect(status).not.toContainText("exported");
  await page.waitForTimeout(800);
  expect(downloads).toBe(0);
  expect(off).toEqual([]);
});

test("limits are enforced before inflation in the production chunk", async ({ page }) => {
  await page.goto("/");

  // path traversal
  const traversal = new JSZip();
  traversal.file("manuscript.md", "# T");
  traversal.file("../../evil.sh", "echo bad");
  const t = await importWithChunk(page, await traversal.generateAsync({ type: "uint8array" }), "traversal.zip");
  expect(t.ok).toBe(false);
  expect(!t.ok && t.message).toMatch(/path traversal/i);

  // compression-ratio bomb: 30 MiB of zeros deflates to a few KB (>100:1)
  const bomb = new JSZip();
  bomb.file("manuscript.md", "# B");
  bomb.file("assets/pad.bin", Buffer.alloc(30 * 1024 * 1024), { compression: "DEFLATE" });
  const b = await importWithChunk(page, await bomb.generateAsync({ type: "uint8array", compression: "DEFLATE" }), "bomb.zip");
  expect(b.ok).toBe(false);
  expect(!b.ok && b.message).toMatch(/exceeds|compression ratio/i);

  // single entry over the per-entry cap (25 MiB of pseudo-random-ish data stored, ratio fine)
  const big = new JSZip();
  big.file("manuscript.md", "# Big");
  const noise = Buffer.alloc(21 * 1024 * 1024);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
  big.file(`assets/${"a".repeat(64)}.png`, noise, { compression: "STORE" });
  const g = await importWithChunk(page, await big.generateAsync({ type: "uint8array", compression: "STORE" }), "big.zip");
  expect(g.ok).toBe(false);
  expect(!g.ok && g.message).toMatch(/maximum|exceeds/i);

  // tampered asset: filename sha does not match bytes
  const fake = "e".repeat(64);
  const tamper = new JSZip();
  tamper.file("manuscript.md", `![Tampered](assets/${fake}.png)`);
  tamper.file(`assets/${fake}.png`, new Uint8Array([1, 2, 3, 4]));
  const m = await importWithChunk(page, await tamper.generateAsync({ type: "uint8array" }), "tampered.zip");
  expect(m.ok).toBe(false);
  expect(!m.ok && m.message).toMatch(/SHA-256 mismatch/i);
});

test("remote image URLs inside an imported bundle are never fetched", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await page.goto("/");
  const zip = new JSZip();
  zip.file("manuscript.md", "# Security Test\n\n![External Image](https://example.invalid/untrusted.png)\n\nSafe text.");
  const r = await importWithChunk(page, await zip.generateAsync({ type: "uint8array" }), "security.zip");
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.draft.assets).toHaveLength(0);
  expect(r.draft.warnings.some((w: string) => w.includes("https://example.invalid/untrusted.png"))).toBe(true);
  expect(r.draft.project.entries[0].text).toContain("https://example.invalid/untrusted.png");
  await page.waitForTimeout(800);
  expect(off).toEqual([]);
});

test("listener liveness: an in-page off-origin request is counted by the same watcher", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await page.goto("/");
  await page.evaluate(() => {
    void fetch("https://example.invalid/leak.png", { mode: "no-cors" }).catch(() => undefined);
  });
  await expect.poll(() => off.length).toBe(1);
});

test("UI import of a .zip bundle through the writing-import input restores image, table and notes", async ({ page }) => {
  await buildRichProject(page);
  const { bytes, filename } = await exportBundle(page);
  await page.getByRole("button", { name: /Projects|Library/ }).first().click().catch(() => undefined);
  await page.locator("#import-writing-text").setInputFiles({ name: filename, mimeType: "application/zip", buffer: bytes });
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Markdown bundle");
  const pills = dialog.locator(".count-pill");
  await expect(pills.filter({ hasText: "1 image" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "1 table" })).toHaveCount(1);
  await expect(pills.filter({ hasText: "2 notes" })).toHaveCount(1);
});

async function backToLibrary(page: Page) {
  await page.locator(".tabs-library").click();
  await expect(page.locator("#import-writing-text")).toBeAttached();
}

test("writing-import input accepts .zip and mentions Markdown bundles", async ({ page }) => {
  await page.goto("/");
  const accept = await page.locator("#import-writing-text").getAttribute("accept");
  expect(accept).toContain(".zip");
  expect(accept).toContain("application/zip");
  await expect(page.locator("#import-writing-label")).toContainText("Markdown bundle");
});

test("UI import of a bundle carries its image asset into the new project and survives reload", async ({ page, baseURL }) => {
  const off = watchOffOrigin(page, baseURL!);
  await buildRichProject(page);
  const { bytes, filename } = await exportBundle(page);
  await backToLibrary(page);
  await page.locator("#import-writing-text").setInputFiles({ name: filename, mimeType: "application/zip", buffer: bytes });
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Project title").fill("Bundle copy");
  await dialog.getByRole("button", { name: "Import", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Writing editor" });
  await expect(editor.locator("figure.doc-image img")).toBeVisible();
  await expect(editor.locator("table")).toBeVisible();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  // The imported copy is its own project: reload (restoreTabs reopens the last
  // project) and check the image bytes still decode from the asset store.
  await page.reload();
  await expect(editor.locator("figure.doc-image img")).toBeVisible();
  const decoded = await editor.locator("figure.doc-image img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth);
  expect(decoded).toBe(1);
  await backToLibrary(page);
  await expect(page.locator(".project-row")).toHaveCount(2);
  expect(off).toEqual([]);
});

test("cancelling a bundle, a DOCX and an HTML import leaves no new project, even after reload", async ({ page }) => {
  await buildRichProject(page);
  const { bytes, filename } = await exportBundle(page);
  await backToLibrary(page);
  const before = await page.locator(".project-row").count();
  expect(before).toBe(1);
  const dialog = page.getByRole("dialog", { name: "Import writing" });
  const attempts = [
    { name: filename, mimeType: "application/zip", buffer: bytes },
    {
      name: "rich-sample.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: fs.readFileSync(path.resolve("tests/fixtures/rich-import/rich-sample.docx")),
    },
    {
      name: "rich-sample.html",
      mimeType: "text/html",
      buffer: fs.readFileSync(path.resolve("tests/fixtures/rich-import/rich-sample.html")),
    },
  ];
  for (const file of attempts) {
    await page.locator("#import-writing-text").setInputFiles(file);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator(".project-row")).toHaveCount(before);
  }
  await page.reload();
  await backToLibrary(page);
  await expect(page.locator(".project-row")).toHaveCount(before);
});
