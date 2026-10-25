import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { newProject } from "../model";
import { createPendingAsset, sha256Hex } from "../assets/assets";
import type { AssetId, PendingAsset } from "../assets/types";
import type { ExportProject } from "./document";
import { exportMarkdownBundle, importMarkdownBundle } from "./markdownBundle";
import { cell, para, table, text, tinyPng, tinyJpeg } from "./media-fixtures";

describe("Markdown Bundle Export and Import (WP7)", () => {
  async function createTestAssets(): Promise<{ png: PendingAsset; jpeg: PendingAsset; assetsMap: Map<AssetId, PendingAsset> }> {
    const png = await createPendingAsset(tinyPng);
    const jpeg = await createPendingAsset(tinyJpeg);
    const assetsMap = new Map<AssetId, PendingAsset>([
      [png.id, png],
      [jpeg.id, jpeg],
    ]);
    return { png, jpeg, assetsMap };
  }

  function createRichProject(pngId: AssetId, jpegId: AssetId): ExportProject {
    const project = newProject("Bundle Test Project");
    const first = project.entries[0];
    first.title = "Chapter 1";
    first.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Introduction paragraph with a " },
            { type: "text", text: "claim", marks: [{ type: "bold" }] },
            { type: "footnoteReference", attrs: { id: "note-1" } },
            { type: "text", text: "." },
          ],
        },
        {
          type: "image",
          attrs: {
            assetId: pngId,
            alt: "A red pixel diagram",
            title: "Pixel Diagram",
            width: null,
            height: null,
          },
        },
        table(
          [
            cell("tableHeader", para(text("Header 1"))),
            cell("tableHeader", para(text("Header 2"))),
          ],
          [
            cell("tableCell", para(text("Cell 1A")), para(text("Cell 1A line 2"))),
            cell("tableCell", para(text("Cell 1B"))),
          ],
        ),
        {
          type: "image",
          attrs: {
            assetId: jpegId,
            alt: "Tiny JPEG sample",
            title: null,
            width: null,
            height: null,
          },
        },
      ],
    };
    project.research = {
      sources: [],
      notes: [],
      footnotes: [
        {
          id: "note-1",
          text: "First paragraph of note.\n\nSecond paragraph of note.",
        },
      ],
    };
    return project;
  }

  it("exports a zip bundle containing manuscript.md, manifest.json, and assets/<sha>.<ext>", async () => {
    const { png, jpeg, assetsMap } = await createTestAssets();
    const project = createRichProject(png.id, jpeg.id);

    const blob = await exportMarkdownBundle(project, assetsMap);
    expect(blob).toBeInstanceOf(Blob);

    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(zip.file("manuscript.md")).not.toBeNull();
    expect(zip.file("manifest.json")).not.toBeNull();

    const manifestText = await zip.file("manifest.json")!.async("string");
    const manifest = JSON.parse(manifestText);
    expect(manifest.format).toBe("personal-word-markdown-bundle");
    expect(manifest.version).toBe(1);
    expect(manifest.title).toBe("Bundle Test Project");
    expect(manifest.assets).toHaveLength(2);

    expect(zip.file(`assets/${png.id}.png`)).not.toBeNull();
    expect(zip.file(`assets/${jpeg.id}.jpg`)).not.toBeNull();

    const mdText = await zip.file("manuscript.md")!.async("string");
    expect(mdText).toContain(`assets/${png.id}.png`);
    expect(mdText).toContain(`assets/${jpeg.id}.jpg`);
    expect(mdText).toContain("[^1]");
    expect(mdText).toContain("[^1]: First paragraph of note.");
    expect(mdText).toContain("    Second paragraph of note.");
  });

  it("throws an actionable error when exporting if a referenced asset is missing", async () => {
    const { png } = await createTestAssets();
    const project = newProject("Missing Asset Doc");
    project.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            assetId: png.id,
            alt: "Missing image",
            title: null,
            width: null,
            height: null,
          },
        },
      ],
    };

    // Passing an empty map so asset is missing
    const emptyAssets = new Map<AssetId, PendingAsset>();
    await expect(exportMarkdownBundle(project, emptyAssets)).rejects.toThrow(
      new RegExp(`An image is missing from this export \\(asset ${png.id.slice(0, 12)}`),
    );
  });

  it("round-trips writing, images, GFM tables, and multi-paragraph footnotes through export and import", async () => {
    const { png, jpeg, assetsMap } = await createTestAssets();
    const project = createRichProject(png.id, jpeg.id);

    const blob = await exportMarkdownBundle(project, assetsMap);
    const draft = await importMarkdownBundle(blob, "bundle.zip");

    expect(draft.format).toBe("Markdown bundle");
    expect(draft.filename).toBe("bundle.zip");
    expect(draft.project.title).toBe("Bundle Test Project");

    // Asset verification
    expect(draft.assets).toHaveLength(2);
    const assetIds = draft.assets.map((a) => a.id).sort();
    expect(assetIds).toEqual([png.id, jpeg.id].sort());

    // Counts verification
    expect(draft.counts.images).toBe(2);
    expect(draft.counts.tables).toBe(1);
    expect(draft.counts.notes).toBe(1);
    expect(draft.counts.paragraphs).toBeGreaterThanOrEqual(1);

    // Footnote verification
    expect(draft.project.research?.footnotes).toHaveLength(1);
    const noteText = draft.project.research?.footnotes[0].text;
    expect(noteText).toBe("First paragraph of note.\n\nSecond paragraph of note.");

    // Content AST verification
    const contentStr = JSON.stringify(draft.project.entries[0].content);
    expect(contentStr).toContain('"table"');
    expect(contentStr).toContain('"tableHeader"');
    expect(contentStr).toContain('"tableCell"');
    expect(contentStr).toContain("Cell 1A");
    expect(contentStr).toContain("Cell 1A line 2");
    expect(contentStr).toContain('"footnoteReference"');
    expect(contentStr).toContain('"image"');
    expect(contentStr).toContain(png.id);
    expect(contentStr).toContain(jpeg.id);
  });

  describe("Security and Pre-Inflation Defenses", () => {
    it("rejects zip archives missing manuscript.md with a clear message", async () => {
      const zip = new JSZip();
      zip.file("manifest.json", JSON.stringify({ format: "personal-word-markdown-bundle" }));
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "empty.zip")).rejects.toThrow(
        /Archive does not contain manuscript\.md/i,
      );
    });

    it("rejects zip files with path traversal filenames before inflation", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("../evil.txt", "exploit");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal.zip")).rejects.toThrow(
        /path traversal/i,
      );
    });

    it("rejects zip files with absolute path traversal filenames before inflation", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("/etc/passwd", "exploit");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "absolute.zip")).rejects.toThrow(
        /path traversal/i,
      );
    });

    it("rejects zip files exceeding entry count limit (2000) before inflation", async () => {
      // Create minimal zip and doctor central directory entry count
      const zip = new JSZip();
      zip.file("manuscript.md", "hello");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const minBuf = new Uint8Array(bytes.length);
      minBuf.set(bytes);
      // Find EOCD signature 0x06054b50 and set entry count to 2001
      for (let i = minBuf.length - 22; i >= 0; i--) {
        if (
          minBuf[i] === 0x50 &&
          minBuf[i + 1] === 0x4b &&
          minBuf[i + 2] === 0x05 &&
          minBuf[i + 3] === 0x06
        ) {
          const view = new DataView(minBuf.buffer, minBuf.byteOffset, minBuf.byteLength);
          view.setUint16(i + 8, 2001, true);
          view.setUint16(i + 10, 2001, true);
          break;
        }
      }

      await expect(importMarkdownBundle(minBuf, "too-many-entries.zip")).rejects.toThrow(
        /exceeds maximum entry count of 2000/i,
      );
    });

    it("rejects zip bombs with compression ratios exceeding 100:1 before inflation", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "a".repeat(20000), { compression: "DEFLATE" });
      const bytes = await zip.generateAsync({ type: "uint8array" });

      // Find central directory entry for manuscript.md and manipulate uncompressedSize
      for (let i = 0; i < bytes.length - 46; i++) {
        if (
          bytes[i] === 0x50 &&
          bytes[i + 1] === 0x4b &&
          bytes[i + 2] === 0x01 &&
          bytes[i + 3] === 0x02
        ) {
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const compSize = view.getUint32(i + 20, true);
          if (compSize > 0) {
            view.setUint32(i + 24, compSize * 150, true); // ratio 150:1
            break;
          }
        }
      }

      await expect(importMarkdownBundle(bytes, "zipbomb.zip")).rejects.toThrow(
        /compression ratio/i,
      );
    });
  });

  describe("Cryptographic and Format Tampering Guards", () => {
    it("rejects bundles where an asset payload does not match its SHA-256 filename", async () => {
      const { png } = await createTestAssets();
      const fakeSha = "0".repeat(64);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Tampered](assets/${fakeSha}.png)`);
      zip.file(`assets/${fakeSha}.png`, png.bytes); // png bytes hash to real sha, not fakeSha

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "tampered.zip")).rejects.toThrow(
        /SHA-256 mismatch/i,
      );
    });

    it("rejects bundles containing non-image files masquerading as images", async () => {
      const fakeBytes = new TextEncoder().encode("Not a real PNG file header");
      const fakeSha = await sha256Hex(fakeBytes);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Bad](assets/${fakeSha}.png)`);
      zip.file(`assets/${fakeSha}.png`, fakeBytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "corrupt-asset.zip")).rejects.toThrow(
        /not a valid image/i,
      );
    });
  });

  describe("Network Isolation and AbortSignal", () => {
    it("retains remote image URLs as literal text with warning and produces zero network calls", async () => {
      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        "Introduction paragraph.\n\n![Remote image](https://example.invalid/evil.png)\n\nConclusion.",
      );

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "remote.zip");

      expect(draft.assets).toHaveLength(0);
      expect(draft.counts.images).toBe(0);
      expect(draft.warnings.some((w) => w.includes("https://example.invalid/evil.png"))).toBe(true);
      expect(draft.project.entries[0].text).toContain("https://example.invalid/evil.png");
    });

    it("aborts cleanly when AbortSignal is triggered", async () => {
      const controller = new AbortController();
      controller.abort();

      const zip = new JSZip();
      zip.file("manuscript.md", "# Aborted");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(
        importMarkdownBundle(bytes, "aborted.zip", { signal: controller.signal }),
      ).rejects.toThrow(/aborted/i);
    });
  });
});
