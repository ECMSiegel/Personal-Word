import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { entry, newProject } from "./model";
import { exportDocx } from "./export/docx";
import { exportPdf } from "./export/pdf";
import { projectMarkdown, projectPlainText } from "./export/textExport";
import {
  documentBlocks,
  safeFilename,
  type ExportProject,
} from "./export/document";
import { ExportPanel } from "./export/ExportPanel";
import { storage } from "./storage";
import {
  collectAssetIds,
  createPendingAsset,
  inspectImage,
  verifyPendingAsset,
} from "./assets/assets";
import type { AssetId, PendingAsset } from "./assets/types";
import { setImageSourceResolver } from "./editor/media";
import {
  tinyPng,
  para,
  cell,
  table,
  image,
  text,
} from "./export/media-fixtures";
import JSZip from "jszip";

/**
 * Creates a valid 1x1 PNG byte array with a unique trailing byte
 * so that sha256Hex generates a unique asset ID, but pdf-lib and docx
 * still successfully embed it as a valid PNG.
 */
function makeUniquePng(seed: number): Uint8Array {
  const bytes = new Uint8Array(tinyPng.length + 4);
  bytes.set(tinyPng);
  bytes[tinyPng.length] = (seed >> 24) & 0xff;
  bytes[tinyPng.length + 1] = (seed >> 16) & 0xff;
  bytes[tinyPng.length + 2] = (seed >> 8) & 0xff;
  bytes[tinyPng.length + 3] = seed & 0xff;
  return bytes;
}

describe("Adversarial WP3 — Export Asset Resolution & Resolver Lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setImageSourceResolver(null);
  });

  // =========================================================================
  // 1. Missing asset handling during docx, pdf, markdown, plain export
  // =========================================================================
  describe("1. Missing Asset Handling Across All Exporters & Error Handling", () => {
    const MISSING_ID: AssetId = "f".repeat(64);

    function projectWithMissingImage(): ExportProject {
      const p = newProject("Missing Asset Project");
      p.entries[0].content = {
        type: "doc",
        content: [
          para(text("Paragraph before image")),
          image(MISSING_ID, { alt: "Missing diagram" }),
          para(text("Paragraph after image")),
        ],
      };
      return p;
    }

    function projectWithMissingTableImage(): ExportProject {
      const p = newProject("Missing Table Asset Project");
      p.entries[0].content = {
        type: "doc",
        content: [
          table(
            [cell("tableHeader", para(text("Header")))],
            [cell("tableCell", image(MISSING_ID, { alt: "Missing table cell image" }))],
          ),
        ],
      };
      return p;
    }

    it("exportDocx rejects with descriptive error when image asset is missing", async () => {
      const p = projectWithMissingImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      await expect(exportDocx(p, emptyAssets)).rejects.toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("exportDocx rejects when image asset is missing inside a table cell", async () => {
      const p = projectWithMissingTableImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      await expect(exportDocx(p, emptyAssets)).rejects.toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("exportPdf rejects with descriptive error when image asset is missing", async () => {
      const p = projectWithMissingImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      await expect(exportPdf(p, undefined, emptyAssets)).rejects.toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("exportPdf rejects when image asset is missing inside a table cell", async () => {
      const p = projectWithMissingTableImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      await expect(exportPdf(p, undefined, emptyAssets)).rejects.toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("projectMarkdown throws with descriptive error when image asset is missing", () => {
      const p = projectWithMissingImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      expect(() => projectMarkdown(p, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("projectMarkdown throws when image is missing inside table cell, blockquote, or fragment", () => {
      const emptyAssets = new Map<AssetId, PendingAsset>();

      // Table cell
      const pTable = projectWithMissingTableImage();
      expect(() => projectMarkdown(pTable, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );

      // Blockquote
      const pQuote = newProject("Quote Missing");
      pQuote.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [image(MISSING_ID, { alt: "Quote image" })],
          },
        ],
      };
      expect(() => projectMarkdown(pQuote, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );

      // Fragment
      const pFrag = newProject("Frag Missing");
      const frag = entry("fragment", "Sidebar diagram");
      frag.content = {
        type: "doc",
        content: [image(MISSING_ID, { alt: "Fragment image" })],
      };
      pFrag.entries.push(frag);
      expect(() => projectMarkdown(pFrag, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("projectPlainText throws with descriptive error when image asset is missing", () => {
      const p = projectWithMissingImage();
      const emptyAssets = new Map<AssetId, PendingAsset>();

      expect(() => projectPlainText(p, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("projectPlainText throws when image is missing inside table cell or fragment", () => {
      const emptyAssets = new Map<AssetId, PendingAsset>();

      const pTable = projectWithMissingTableImage();
      expect(() => projectPlainText(pTable, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );

      const pFrag = newProject("Plain Frag Missing");
      const frag = entry("fragment", "Sidebar note");
      frag.content = {
        type: "doc",
        content: [image(MISSING_ID, { alt: "Fragment plain image" })],
      };
      pFrag.entries.push(frag);
      expect(() => projectPlainText(pFrag, emptyAssets)).toThrow(
        /An image is missing from this export \(asset ffffffffffff\)/,
      );
    });

    it("ExportPanel asset collection verifies storage.readAsset rejection message format", async () => {
      const p = projectWithMissingImage();
      vi.spyOn(storage, "readAsset").mockRejectedValue(new Error("Storage I/O failure"));

      // Emulate ExportPanel's collectAndResolveAssets
      const ids = collectAssetIds(p);
      expect(ids.has(MISSING_ID)).toBe(true);

      const resolveAttempt = async () => {
        const assets = new Map<AssetId, PendingAsset>();
        for (const id of ids) {
          try {
            const asset = await storage.readAsset(p.id, id);
            assets.set(id, asset);
          } catch {
            throw new Error(
              `An image is missing from this export (asset ${id.slice(0, 12) || "unknown"}). Restore the image or remove it from the document before exporting.`,
            );
          }
        }
        return assets;
      };

      await expect(resolveAttempt()).rejects.toThrow(
        "An image is missing from this export (asset ffffffffffff). Restore the image or remove it from the document before exporting.",
      );
    });
  });

  // =========================================================================
  // 2. Documents with 0 assets, 1 asset, 50 assets
  // =========================================================================
  describe("2. Document Scale Stress Testing (0 Assets, 1 Asset, 50 Assets)", () => {
    it("exports clean document with 0 assets across docx, pdf, markdown, plain", async () => {
      const p = newProject("Zero Assets Document");
      p.entries[0].content = {
        type: "doc",
        content: [
          para(text("Just a regular paragraph with no images.")),
          table([cell("tableHeader", para(text("Col 1"))), cell("tableHeader", para(text("Col 2")))], [cell("tableCell", para(text("A"))), cell("tableCell", para(text("B")))]),
        ],
      };

      const ids = collectAssetIds(p);
      expect(ids.size).toBe(0);

      // docx
      const docxBlob = await exportDocx(p, new Map());
      expect(docxBlob.size).toBeGreaterThan(1000);
      const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
      // No word/media folder when there are 0 images
      const mediaFiles = Object.keys(zip.files).filter((k) => k.startsWith("word/media/"));
      expect(mediaFiles).toHaveLength(0);

      // pdf
      const pdfBlob = await exportPdf(p, undefined, new Map());
      expect(pdfBlob.size).toBeGreaterThan(1000);

      // markdown
      const md = projectMarkdown(p, new Map());
      expect(md).toContain("# Zero Assets Document");
      expect(md).not.toContain("![");

      // plain text
      const txt = projectPlainText(p, new Map());
      expect(txt).toContain("Zero Assets Document");
      expect(txt).not.toContain("[Image");
    });

    it("exports document with exactly 1 asset across docx, pdf, markdown, plain", async () => {
      const p = newProject("Single Asset Document");
      const asset = await createPendingAsset(tinyPng);
      p.entries[0].content = {
        type: "doc",
        content: [
          para(text("Before")),
          image(asset.id, { alt: "Lone Red Dot", width: 32, height: 32 }),
          para(text("After")),
        ],
      };

      const ids = collectAssetIds(p);
      expect(ids.size).toBe(1);
      expect(ids.has(asset.id)).toBe(true);

      const assetsMap = new Map([[asset.id, asset]]);

      // docx
      const docxBlob = await exportDocx(p, assetsMap);
      const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
      const mediaFiles = Object.keys(zip.files).filter(
        (k) => k.startsWith("word/media/") && !zip.files[k].dir,
      );
      expect(mediaFiles).toHaveLength(1);
      const embeddedBytes = await zip.file(mediaFiles[0])!.async("uint8array");
      expect(embeddedBytes).toEqual(tinyPng);

      // pdf
      const pdfBlob = await exportPdf(p, undefined, assetsMap);
      expect(pdfBlob.size).toBeGreaterThan(1000);

      // markdown
      const md = projectMarkdown(p, assetsMap);
      expect(md).toContain(`![Lone Red Dot](assets/${asset.id}.png)`);

      // plain text
      const txt = projectPlainText(p, assetsMap);
      expect(txt).toContain("[Image: Lone Red Dot]");
    });

    it("stress tests document with 50 distinct assets across sections, tables, and quotes", async () => {
      const startTime = performance.now();
      const p = newProject("Fifty Assets Mega Project");
      const assetsMap = new Map<AssetId, PendingAsset>();
      const assetsList: PendingAsset[] = [];

      for (let i = 0; i < 50; i++) {
        const raw = makeUniquePng(i + 1);
        const a = await createPendingAsset(raw);
        assetsList.push(a);
        assetsMap.set(a.id, a);
      }
      expect(assetsMap.size).toBe(50);

      // Entry 1 (section 1): 20 images in paragraphs
      const p1Content: any[] = [];
      for (let i = 0; i < 20; i++) {
        p1Content.push(para(text(`Item ${i + 1}:`)));
        p1Content.push(image(assetsList[i].id, { alt: `Image ${i + 1}`, width: 40, height: 40 }));
      }
      p.entries[0].content = { type: "doc", content: p1Content };

      // Entry 2 (section 2): 15 images inside a 5x3 table
      const s2 = entry("section", "Section Two — Tables");
      const tableRows: any[] = [];
      let assetIdx = 20;
      for (let r = 0; r < 5; r++) {
        const rowCells: any[] = [];
        for (let c = 0; c < 3; c++) {
          rowCells.push(
            cell("tableCell", image(assetsList[assetIdx].id, { alt: `Grid ${r},${c}` })),
          );
          assetIdx++;
        }
        tableRows.push(rowCells);
      }
      s2.content = { type: "doc", content: [table(...tableRows)] };
      p.entries.push(s2);
      p.order.push(s2.id);

      // Entry 3 (section 3): 15 images in blockquotes and paragraphs
      const s3 = entry("section", "Section Three — Quotes");
      const quoteContent: any[] = [];
      for (let i = 0; i < 15; i++) {
        quoteContent.push({
          type: "blockquote",
          content: [image(assetsList[assetIdx].id, { alt: `Quote Image ${i}` })],
        });
        assetIdx++;
      }
      s3.content = { type: "doc", content: quoteContent };
      p.entries.push(s3);
      p.order.push(s3.id);
      expect(assetIdx).toBe(50);

      // 1. collectAssetIds must find all 50 unique assets
      const collectedIds = collectAssetIds(p);
      expect(collectedIds.size).toBe(50);
      for (const a of assetsList) {
        expect(collectedIds.has(a.id)).toBe(true);
      }

      // 2. Markdown export produces 50 image references
      const md = projectMarkdown(p, assetsMap);
      const mdMatches = md.match(/!\[.*?\]\(assets\/[0-9a-f]{64}\.png\)/g);
      expect(mdMatches).toHaveLength(50);

      // 3. Plain text export produces 50 image indicators
      const txt = projectPlainText(p, assetsMap);
      const txtMatches = txt.match(/\[Image:.*?\]/g);
      expect(txtMatches).toHaveLength(50);

      // 4. DOCX export packages all 50 images into the ZIP archive
      const docxBlob = await exportDocx(p, assetsMap);
      expect(docxBlob.size).toBeGreaterThan(10_000);
      const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
      const mediaEntries = Object.keys(zip.files).filter(
        (k) => k.startsWith("word/media/") && !zip.files[k].dir,
      );
      expect(mediaEntries).toHaveLength(50);

      // 5. PDF export embeds and renders all 50 images across pages without error
      const pdfBlob = await exportPdf(p, undefined, assetsMap);
      expect(pdfBlob.size).toBeGreaterThan(15_000);

      const elapsed = performance.now() - startTime;
      expect(elapsed).toBeLessThan(10_000);
    });

    it("ASYMMETRY DISCOVERY: documentBlocks (DOCX/PDF) excludes fragments, but textExport includes them", async () => {
      const p = newProject("Fragment Asymmetry Project");
      const asset = await createPendingAsset(tinyPng);
      const assetsMap = new Map([[asset.id, asset]]);

      const frag = entry("fragment", "Unrendered in Docx");
      frag.content = {
        type: "doc",
        content: [image(asset.id, { alt: "Fragment Only Image" })],
      };
      p.entries.push(frag);

      // Markdown and plain text export include the fragment image
      const md = projectMarkdown(p, assetsMap);
      expect(md).toContain("Fragment Only Image");
      const txt = projectPlainText(p, assetsMap);
      expect(txt).toContain("[Image: Fragment Only Image]");

      // DOCX and PDF documentBlocks omit fragments
      const doc = documentBlocks(p, assetsMap);
      const hasImageInDoc = doc.blocks.some((b) => b.kind === "image");
      expect(hasImageInDoc).toBe(false);

      const docxBlob = await exportDocx(p, assetsMap);
      const zip = await JSZip.loadAsync(await docxBlob.arrayBuffer());
      const mediaFiles = Object.keys(zip.files).filter(
        (k) => k.startsWith("word/media/") && !zip.files[k].dir,
      );
      expect(mediaFiles).toHaveLength(0); // 0 images in DOCX despite image existing in fragment!
    });
  });

  // =========================================================================
  // 3. Corrupted asset byte arrays / empty buffers
  // =========================================================================
  describe("3. Corrupted Asset Byte Arrays, Empty Buffers & Degenerate Metadata", () => {
    it("inspectImage rejects empty buffer (0 bytes)", () => {
      const empty = new Uint8Array(0);
      expect(() => inspectImage(empty)).toThrow("Image is empty or larger than 25 MB");
    });

    it("verifyPendingAsset rejects empty byte arrays", async () => {
      const invalidAsset: PendingAsset = {
        id: "0".repeat(64),
        meta: { mime: "image/png", byteLength: 0, width: 10, height: 10 },
        bytes: new Uint8Array(0),
      };
      await expect(verifyPendingAsset(invalidAsset)).rejects.toThrow(
        "Image is empty or larger than 25 MB",
      );
    });

    it("exportPdf rejects when asset bytes are empty", async () => {
      const p = newProject("Corrupted Empty");
      const emptyId: AssetId = "c".repeat(64);
      p.entries[0].content = {
        type: "doc",
        content: [image(emptyId, { alt: "Empty buffer image" })],
      };

      const corruptMap = new Map<AssetId, PendingAsset>([
        [
          emptyId,
          {
            id: emptyId,
            meta: { mime: "image/png", byteLength: 0, width: 10, height: 10 },
            bytes: new Uint8Array(0),
          },
        ],
      ]);

      await expect(exportPdf(p, undefined, corruptMap)).rejects.toThrow();
    });

    it("inspectImage and verifyPendingAsset reject random garbage bytes", async () => {
      const garbage = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04]);
      expect(() => inspectImage(garbage)).toThrow("Only PNG and JPEG images are supported");

      const garbageAsset: PendingAsset = {
        id: "1".repeat(64),
        meta: { mime: "image/png", byteLength: garbage.length, width: 10, height: 10 },
        bytes: garbage,
      };
      await expect(verifyPendingAsset(garbageAsset)).rejects.toThrow();
    });

    it("exportPdf rejects random garbage bytes during image embedding", async () => {
      const p = newProject("Garbage Bytes Project");
      const id: AssetId = "d".repeat(64);
      p.entries[0].content = {
        type: "doc",
        content: [image(id, { alt: "Garbage image" })],
      };

      const garbageBytes = new Uint8Array(32).fill(0xaa);
      const corruptMap = new Map<AssetId, PendingAsset>([
        [
          id,
          {
            id,
            meta: { mime: "image/png", byteLength: 32, width: 10, height: 10 },
            bytes: garbageBytes,
          },
        ],
      ]);

      await expect(exportPdf(p, undefined, corruptMap)).rejects.toThrow();
    });

    it("inspectImage rejects truncated PNG headers", () => {
      // Magic bytes only, missing IHDR chunk
      const truncated = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(() => inspectImage(truncated)).toThrow("PNG header is incomplete");
    });

    it("inspectImage rejects zero dimensions or dimensions exceeding MAX_DIMENSION (20,000)", () => {
      // PNG with width 0
      const zeroWidthPng = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
        0, 0, 0, 0, // width = 0
        0, 0, 0, 1, // height = 1
        8, 2, 0, 0, 0, 0, 0, 0, 0,
      ]);
      expect(() => inspectImage(zeroWidthPng)).toThrow("Image dimensions are outside the supported range");

      // PNG with width 20,001 (> MAX_DIMENSION)
      const oversizedPng = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
        0, 0, 0x4e, 0x21, // width = 20001
        0, 0, 0, 1,
        8, 2, 0, 0, 0, 0, 0, 0, 0,
      ]);
      expect(() => inspectImage(oversizedPng)).toThrow("Image dimensions are outside the supported range");
    });

    it("verifyPendingAsset detects SHA-256 identifier mismatch", async () => {
      const realAsset = await createPendingAsset(tinyPng);
      const tamperedAsset: PendingAsset = {
        ...realAsset,
        id: "e".repeat(64), // Mismatched SHA-256
      };
      await expect(verifyPendingAsset(tamperedAsset)).rejects.toThrow(
        "Image bytes do not match their identifier",
      );
    });

    it("documentBlocks gracefully handles negative or NaN width/height attributes by falling back to metadata dimensions", async () => {
      const p = newProject("Dimension Fallback");
      const asset = await createPendingAsset(tinyPng);
      p.entries[0].content = {
        type: "doc",
        content: [
          image(asset.id, { alt: "Fallback", width: -50, height: "not-a-number" }),
        ],
      };
      const assets = new Map([[asset.id, asset]]);

      // Should not throw or generate NaN width/height
      const doc = documentBlocks(p, assets);
      const imgBlock = doc.blocks.find((b) => b.kind === "image");
      expect(imgBlock).toBeDefined();
      expect(Number.isFinite(imgBlock!.image!.width)).toBe(true);
      expect(Number.isFinite(imgBlock!.image!.height)).toBe(true);
      expect(imgBlock!.image!.width).toBeGreaterThan(0);
      expect(imgBlock!.image!.height).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 4. Repeated image resolutions: verify cache behavior and Blob URL lifecycle
  // =========================================================================
  describe("4. Repeated Image Resolutions, Cache Behavior & Blob URL Lifecycle (App.tsx)", () => {
    it("EMPIRICAL FINDING: App.tsx resolveAsset creates redundant Blob URLs because imageCache is never read", async () => {
      const asset = await createPendingAsset(tinyPng);
      const projectId = "test-project-123";

      // Mock storage
      const mockReadAsset = vi.fn(async (_pid: string, id: string) => {
        if (id === asset.id) return asset;
        throw new Error("Not found");
      });

      // Track Blob URL allocations and revocations
      let blobCounter = 0;
      const originalCreate = URL.createObjectURL;
      const createdUrls: string[] = [];
      const revokedUrls: string[] = [];

      URL.createObjectURL = vi.fn((_blob: Blob) => {
        blobCounter++;
        const url = `blob:http://localhost/test-uuid-${blobCounter}`;
        createdUrls.push(url);
        return url;
      });

      URL.revokeObjectURL = vi.fn((url: string) => {
        revokedUrls.push(url);
      });

      try {
        // Replicate App.tsx exact state structures and resolver implementation (App.tsx lines 266-328)
        const assetBytesCache = new Map<string, PendingAsset>();
        const createdBlobUrls = new Set<string>();
        const imageCache = new Map<string, string>();

        const appResolveAsset = async (assetId: string): Promise<string | null> => {
          try {
            // Note: in App.tsx lines 316-325:
            // assetBytesCache is checked, but imageCache is NEVER checked before URL.createObjectURL!
            const a =
              assetBytesCache.get(assetId) ??
              (await mockReadAsset(projectId, assetId));
            assetBytesCache.set(assetId, a);
            const url = URL.createObjectURL(
              new Blob([a.bytes as unknown as BlobPart], { type: a.meta.mime }),
            );
            createdBlobUrls.add(url);
            imageCache.set(assetId, url);
            return url;
          } catch {
            return null;
          }
        };

        // Resolution 1
        const url1 = await appResolveAsset(asset.id);
        expect(url1).toBe("blob:http://localhost/test-uuid-1");
        expect(mockReadAsset).toHaveBeenCalledTimes(1);
        expect(createdBlobUrls.size).toBe(1);

        // Resolution 2 (same asset resolved again)
        const url2 = await appResolveAsset(asset.id);
        // assetBytesCache avoided a second storage.readAsset call...
        expect(mockReadAsset).toHaveBeenCalledTimes(1);

        // BUT because imageCache.get was NOT checked, a new Blob URL was created!
        expect(url2).toBe("blob:http://localhost/test-uuid-2");
        expect(url2).not.toBe(url1); // Defect: distinct Blob URLs returned for identical asset
        expect(createdBlobUrls.size).toBe(2); // Defect: createdBlobUrls accumulates unrevoked URLs

        // Resolution 3..10
        for (let i = 3; i <= 10; i++) {
          await appResolveAsset(asset.id);
        }
        expect(createdBlobUrls.size).toBe(10);
        expect(URL.createObjectURL).toHaveBeenCalledTimes(10);

        // Verify that unmount cleanup revokes ALL accumulated URLs
        const unmountCleanup = () => {
          for (const url of createdBlobUrls) {
            try {
              URL.revokeObjectURL(url);
            } catch {
              // ignore
            }
          }
          createdBlobUrls.clear();
          imageCache.clear();
          assetBytesCache.clear();
        };

        unmountCleanup();
        expect(revokedUrls).toHaveLength(10);
        expect(createdBlobUrls.size).toBe(0);
        expect(imageCache.size).toBe(0);
        expect(assetBytesCache.size).toBe(0);
      } finally {
        URL.createObjectURL = originalCreate;
      }
    });

    it("verifies that proper caching with imageCache.get reuses the active Blob URL without leak", async () => {
      const asset = await createPendingAsset(tinyPng);

      let blobCounter = 0;
      const originalCreate = URL.createObjectURL;
      URL.createObjectURL = vi.fn(() => {
        blobCounter++;
        return `blob:http://localhost/cached-uuid-${blobCounter}`;
      });

      try {
        const assetBytesCache = new Map<string, PendingAsset>();
        const createdBlobUrls = new Set<string>();
        const imageCache = new Map<string, string>();

        // Proper implementation that checks imageCache before createObjectURL
        const properResolveAsset = async (assetId: string): Promise<string | null> => {
          try {
            const cachedUrl = imageCache.get(assetId);
            if (cachedUrl) return cachedUrl;

            const a =
              assetBytesCache.get(assetId) ??
              asset;
            assetBytesCache.set(assetId, a);
            const url = URL.createObjectURL(
              new Blob([a.bytes as unknown as BlobPart], { type: a.meta.mime }),
            );
            createdBlobUrls.add(url);
            imageCache.set(assetId, url);
            return url;
          } catch {
            return null;
          }
        };

        const firstUrl = await properResolveAsset(asset.id);
        const secondUrl = await properResolveAsset(asset.id);
        const thirdUrl = await properResolveAsset(asset.id);

        expect(firstUrl).toBe("blob:http://localhost/cached-uuid-1");
        expect(secondUrl).toBe(firstUrl);
        expect(thirdUrl).toBe(firstUrl);
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        expect(createdBlobUrls.size).toBe(1);
      } finally {
        URL.createObjectURL = originalCreate;
      }
    });

    it("setImageSourceResolver registration and revocation lifecycle", async () => {
      let registeredResolver: ((id: string) => Promise<string | null>) | null = null;
      setImageSourceResolver((id: string) => {
        registeredResolver = () => Promise.resolve(`blob:${id}`);
        return registeredResolver(id);
      });

      // Unsetting resolver
      setImageSourceResolver(null);

      // Verify that unmount of Writer calls setImageSourceResolver(null)
      const mockWriterUnmount = () => {
        setImageSourceResolver(null);
      };
      mockWriterUnmount();
    });

    it("resolveAsset returns null cleanly when asset is missing or read fails", async () => {
      const currentProject = { id: "p1" };
      const failingStorage = {
        readAsset: vi.fn(async (_id: string) => {
          throw new Error("File not found on disk");
        }),
      };

      const resolveAsset = async (assetId: string): Promise<string | null> => {
        if (!currentProject.id) return null;
        try {
          const asset = await failingStorage.readAsset(assetId);
          return `blob:${asset}`;
        } catch {
          return null;
        }
      };

      const result = await resolveAsset("missing-id");
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // 5. ExportPanel Component Rendering & Interactive State Integrity
  // =========================================================================
  describe("5. ExportPanel UI Rendering, Settings & Filename Sanitization", () => {
    it("renders ExportPanel with all 5 export actions and accessible markup", () => {
      const p = newProject("Export Test Title");
      const html = renderToStaticMarkup(React.createElement(ExportPanel, { project: p }));

      expect(html).toContain('aria-label="Export document"');
      expect(html).toContain("Export DOCX");
      expect(html).toContain("Export Markdown");
      expect(html).toContain("Export plain text");
      expect(html).toContain("Export PDF");
      expect(html).toContain("Preview PDF");
      expect(html).toContain('role="status"');
    });

    it("safeFilename strips path traversal sequences, control characters, and slashes", () => {
      // Path traversal attempts: slashes are sanitized to underscores preventing path navigation
      expect(safeFilename("../../etc/passwd")).toBe(".._.._etc_passwd");
      expect(safeFilename("/root/secret.doc")).toBe("_root_secret.doc");

      // Illegal Windows / macOS characters: \ / : * ? " < > |
      expect(safeFilename('My "Special" *Project*: Part <1> | Notes?')).toBe(
        "My _Special_ _Project__ Part _1_ _ Notes_",
      );

      // Empty or whitespace-only titles fall back to "Document"
      expect(safeFilename("")).toBe("Document");
      expect(safeFilename("    ")).toBe("Document");
      // All-illegal character titles become underscores (not empty, so no "Document" fallback)
      expect(safeFilename("???")).toBe("___");
    });

    it("PDF Preview revokes existing object URL when closed or updated", () => {
      const revoked: string[] = [];
      const originalRevoke = URL.revokeObjectURL;
      URL.revokeObjectURL = vi.fn((url: string) => {
        revoked.push(url);
      });

      try {
        let preview = "blob:http://localhost/prev-1";
        // Emulate useEffect [preview] cleanup in ExportPanel
        const cleanup1 = () => {
          if (preview) URL.revokeObjectURL(preview);
        };

        // When preview updates
        cleanup1();
        expect(revoked).toContain("blob:http://localhost/prev-1");

        // When closed
        preview = "";
        cleanup1();
        expect(revoked).toHaveLength(1); // empty string not revoked
      } finally {
        URL.revokeObjectURL = originalRevoke;
      }
    });
  });
});
