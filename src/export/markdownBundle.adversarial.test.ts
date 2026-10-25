import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import http from "node:http";
import https from "node:https";
import { newProject } from "../model";
import { createPendingAsset, sha256Hex } from "../assets/assets";
import type { AssetId, PendingAsset } from "../assets/types";
import type { ExportProject } from "./document";
import {
  exportMarkdownBundle,
  importMarkdownBundle,
  type MarkdownBundleManifest,
} from "./markdownBundle";
import { tinyPng, tinyJpeg } from "./media-fixtures";

describe("Adversarial Challenges for Markdown Bundle (Challenger 1 / M3)", () => {
  async function createValidAssets(): Promise<{
    png: PendingAsset;
    jpeg: PendingAsset;
    assetsMap: Map<AssetId, PendingAsset>;
  }> {
    const png = await createPendingAsset(tinyPng);
    const jpeg = await createPendingAsset(tinyJpeg);
    const assetsMap = new Map<AssetId, PendingAsset>([
      [png.id, png],
      [jpeg.id, jpeg],
    ]);
    return { png, jpeg, assetsMap };
  }

  function findEocdOffset(bytes: Uint8Array): number {
    for (let i = bytes.length - 22; i >= 0; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        return i;
      }
    }
    throw new Error("EOCD not found");
  }

  function findFirstCentralDirectoryHeaderOffset(bytes: Uint8Array): number {
    for (let i = 0; i <= bytes.length - 46; i++) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x01 &&
        bytes[i + 3] === 0x02
      ) {
        return i;
      }
    }
    throw new Error("Central directory header not found");
  }

  // =========================================================================
  // 1. Path Traversal Defenses
  // =========================================================================
  describe("1. Path Traversal Defenses", () => {
    it("rejects relative path traversal with forward slashes (../etc/passwd)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("../etc/passwd", "root:x:0:0::/root:/bin/bash");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-unix.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects path traversal with backslashes (..\\win.ini)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("..\\win.ini", "[fonts]");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-win.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects nested relative path traversal (assets/../../secret.txt)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("assets/../../secret.txt", "confidential");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-nested.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects absolute path traversal with leading slash (/etc/shadow)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("/etc/shadow", "root:$6$secret");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-abs-slash.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects absolute path traversal with leading backslash (\\Windows\\system.ini)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("\\Windows\\system.ini", "[drivers]");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-abs-backslash.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects Windows drive-letter absolute paths (C:\\Windows\\System32\\cmd.exe)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      zip.file("C:\\Windows\\System32\\cmd.exe", "MZ...");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(importMarkdownBundle(bytes, "traversal-drive.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });

    it("rejects filenames containing null bytes before inflation", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      // Create valid zip and tamper central directory filename to inject a null byte
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      // Central directory entry format: bytes 46+ are filename
      // Replace second character of filename with null byte
      tampered[cdOffset + 47] = 0x00;

      await expect(importMarkdownBundle(tampered, "nullbyte.zip")).rejects.toThrow(
        /unsafe path traversal entry/i,
      );
    });
  });

  // =========================================================================
  // 2. ZIP Limits, Size Bounds, and Zip Bomb Defenses
  // =========================================================================
  describe("2. ZIP Limits, Size Bounds, and Zip Bomb Defenses", () => {
    it("rejects archive when entry count exceeds 2000 in Central Directory", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Safe");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const eocd = findEocdOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      view.setUint16(eocd + 8, 2001, true); // total entries on disk
      view.setUint16(eocd + 10, 2001, true); // total entries in central directory

      await expect(importMarkdownBundle(tampered, "too-many-entries.zip")).rejects.toThrow(
        /exceeds maximum entry count of 2000/i,
      );
    });

    it("rejects archive when single entry uncompressed size exceeds 20MB", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Safe");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      // Set uncompressed size to 20MB + 1 byte
      view.setUint32(cdOffset + 24, 20 * 1024 * 1024 + 1, true);

      await expect(importMarkdownBundle(tampered, "huge-entry.zip")).rejects.toThrow(
        /exceeds maximum uncompressed size of 20MB/i,
      );
    });

    it("rejects archive when total uncompressed size across entries exceeds 100MB", async () => {
      const zip = new JSZip();
      zip.file("file1.txt", "1");
      zip.file("file2.txt", "2");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);

      // Locate both CD headers and set uncompressed sizes to 60MB each (120MB total)
      let count = 0;
      for (let i = 0; i <= tampered.length - 46; i++) {
        if (
          tampered[i] === 0x50 &&
          tampered[i + 1] === 0x4b &&
          tampered[i + 2] === 0x01 &&
          tampered[i + 3] === 0x02
        ) {
          const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
          view.setUint32(i + 20, 1000, true); // compressed size 1KB
          view.setUint32(i + 24, 60 * 1024 * 1024, true); // uncompressed 60MB (< 20MB check would trip if not careful, wait: 60MB > 20MB)
          count++;
        }
      }
      // If 60MB > 20MB, the per-entry check trips first. Let's create 6 entries of 18MB each!
      const zip6 = new JSZip();
      for (let f = 1; f <= 6; f++) {
        zip6.file(`file${f}.txt`, "data");
      }
      const bytes6 = await zip6.generateAsync({ type: "uint8array" });
      const tampered6 = new Uint8Array(bytes6);
      for (let i = 0; i <= tampered6.length - 46; i++) {
        if (
          tampered6[i] === 0x50 &&
          tampered6[i + 1] === 0x4b &&
          tampered6[i + 2] === 0x01 &&
          tampered6[i + 3] === 0x02
        ) {
          const view = new DataView(tampered6.buffer, tampered6.byteOffset, tampered6.byteLength);
          view.setUint32(i + 20, 200_000, true); // compressed ~200KB (ratio ~90:1, so ratio check passes)
          view.setUint32(i + 24, 18 * 1024 * 1024, true); // uncompressed 18MB (6 * 18MB = 108MB > 100MB)
        }
      }

      await expect(importMarkdownBundle(tampered6, "huge-total.zip")).rejects.toThrow(
        /total uncompressed size exceeds 100MB limit/i,
      );
    });

    it("rejects high compression ratio zip bomb (>100:1 ratio)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "hello world", { compression: "DEFLATE" });
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      const compSize = view.getUint32(cdOffset + 20, true);
      // Set uncompressed size to 101 * compSize (e.g. 101:1 ratio)
      view.setUint32(cdOffset + 24, compSize * 101, true);

      await expect(importMarkdownBundle(tampered, "zipbomb-ratio.zip")).rejects.toThrow(
        /compression ratio exceeds 100:1 \(potential zip bomb\)/i,
      );
    });

    it("rejects zip entry with zero compressed size and non-zero uncompressed size", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "hello world");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      view.setUint32(cdOffset + 20, 0, true); // compSize = 0
      view.setUint32(cdOffset + 24, 5000, true); // uncompSize = 5000

      await expect(importMarkdownBundle(tampered, "zero-compressed.zip")).rejects.toThrow(
        /invalid compression ratio \(potential zip bomb\)/i,
      );
    });

    it("rejects raw archive exceeding maximum compressed size limit of 20MB", async () => {
      // 20MB + 1 byte dummy buffer
      const hugeBuffer = new Uint8Array(20 * 1024 * 1024 + 1);
      await expect(importMarkdownBundle(hugeBuffer, "huge-archive.zip")).rejects.toThrow(
        /exceeds maximum compressed size of 20MB/i,
      );
    });
  });

  // =========================================================================
  // 3. Password Protection and Encryption Rejection
  // =========================================================================
  describe("3. Password Protection & Encryption Rejection", () => {
    it("rejects archive with bit 0 set in general purpose bit flag (encrypted / password-protected)", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Encrypted");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      const currentFlags = view.getUint16(cdOffset + 8, true);
      view.setUint16(cdOffset + 8, currentFlags | 0x0001, true); // Set bit 0 (encryption)

      await expect(importMarkdownBundle(tampered, "encrypted.zip")).rejects.toThrow(
        /Password-protected or encrypted archives are not supported/i,
      );
    });
  });

  // =========================================================================
  // 4. Corrupted ZIP Headers & Central Directory Structural Attacks
  // =========================================================================
  describe("4. Corrupted ZIP Headers & Central Directory Attacks", () => {
    it("rejects truncated ZIP archive smaller than minimal EOCD size (< 22 bytes)", async () => {
      const tinyBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      await expect(importMarkdownBundle(tinyBytes, "tiny.zip")).rejects.toThrow(
        /Invalid ZIP archive: file is too small/i,
      );
    });

    it("rejects archive with missing End-of-Central-Directory signature", async () => {
      const garbage = new Uint8Array(100).fill(0xaa);
      await expect(importMarkdownBundle(garbage, "no-eocd.zip")).rejects.toThrow(
        /End of Central Directory record not found/i,
      );
    });

    it("rejects archive when Central Directory offset points beyond file boundary", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const eocd = findEocdOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      view.setUint32(eocd + 16, tampered.byteLength + 500, true); // cdOffset beyond file

      await expect(importMarkdownBundle(tampered, "cd-out-of-bounds.zip")).rejects.toThrow(
        /Central directory extends beyond archive boundaries/i,
      );
    });

    it("rejects archive when Central Directory header signature is invalid", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      view.setUint32(cdOffset, 0x02014b99, true); // Corrupted signature

      await expect(importMarkdownBundle(tampered, "bad-cd-sig.zip")).rejects.toThrow(
        /invalid central directory signature/i,
      );
    });

    it("rejects archive when entry header exceeds archive boundaries", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Test");
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const tampered = new Uint8Array(bytes);
      const cdOffset = findFirstCentralDirectoryHeaderOffset(tampered);
      const view = new DataView(tampered.buffer, tampered.byteOffset, tampered.byteLength);
      // Declare fileNameLength = 65000, so 46 + 65000 extends past archive end
      view.setUint16(cdOffset + 28, 65000, true);

      await expect(importMarkdownBundle(tampered, "overflow-header.zip")).rejects.toThrow(
        /entry header exceeds archive boundaries/i,
      );
    });
  });

  // =========================================================================
  // 5. Cryptographic Asset Integrity & Tampering
  // =========================================================================
  describe("5. Cryptographic Asset Integrity & Tampering", () => {
    it("rejects bundle when asset bytes do not match the SHA-256 in its filename", async () => {
      const { png } = await createValidAssets();
      const corruptedSha = "e".repeat(64);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Tampered](assets/${corruptedSha}.png)`);
      zip.file(`assets/${corruptedSha}.png`, png.bytes); // bytes hash to png.id, not corruptedSha

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "sha-tampered.zip")).rejects.toThrow(
        new RegExp(`Asset assets/${corruptedSha}\\.png SHA-256 mismatch`),
      );
    });

    it("rejects bundle when asset bytes match filename SHA but payload is corrupted/non-image bytes", async () => {
      const textBytes = new TextEncoder().encode("<html><body>This is an HTML file, not an image</body></html>");
      const textSha = await sha256Hex(textBytes);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Corrupt](assets/${textSha}.png)`);
      zip.file(`assets/${textSha}.png`, textBytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "fake-image.zip")).rejects.toThrow(
        /not a valid image: Only PNG and JPEG images are supported/i,
      );
    });

    it("rejects bundle when asset has truncated PNG signature (4 bytes)", async () => {
      const truncatedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // \x89PNG
      const truncSha = await sha256Hex(truncatedPng);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Truncated PNG](assets/${truncSha}.png)`);
      zip.file(`assets/${truncSha}.png`, truncatedPng);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "truncated-png.zip")).rejects.toThrow(
        /not a valid image/i,
      );
    });

    it("rejects bundle when asset has truncated JPEG SOI marker (3 bytes)", async () => {
      const truncatedJpg = new Uint8Array([0xff, 0xd8, 0xff]);
      const truncSha = await sha256Hex(truncatedJpg);

      const zip = new JSZip();
      zip.file("manuscript.md", `![Truncated JPEG](assets/${truncSha}.jpg)`);
      zip.file(`assets/${truncSha}.jpg`, truncatedJpg);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      await expect(importMarkdownBundle(bytes, "truncated-jpg.zip")).rejects.toThrow(
        /not a valid image/i,
      );
    });

    it("safely ignores and warns on non-image unexpected file inside assets/ directory", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Document with stray file");
      zip.file("assets/script.sh", "echo 'pwned'");

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "stray-file.zip");

      expect(draft.warnings.some((w) => w.includes("Ignored unexpected file in assets directory: 'assets/script.sh'"))).toBe(true);
      expect(draft.assets).toHaveLength(0);
    });

    it("safely ignores unreferenced assets present in bundle with warning", async () => {
      const { png } = await createValidAssets();
      const zip = new JSZip();
      zip.file("manuscript.md", "# Document with no image references");
      zip.file(`assets/${png.id}.png`, png.bytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "unreferenced.zip");

      expect(draft.assets).toHaveLength(0);
      expect(draft.warnings.some((w) => w.includes(`Unreferenced asset ${png.id} in bundle was ignored`))).toBe(true);
    });

    it("handles image referenced in manuscript.md but missing from assets/ gracefully with warning and zero network", async () => {
      const missingSha = "f".repeat(64);
      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        `# Intro\n\n![Missing Figure](assets/${missingSha}.png)\n\nConclusion.`,
      );

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "missing-asset-file.zip");

      expect(draft.assets).toHaveLength(0);
      expect(draft.counts.images).toBe(0);
      expect(
        draft.warnings.some((w) =>
          w.includes(`Image assets/${missingSha}.png could not be resolved from bundle assets`),
        ),
      ).toBe(true);
      // Retained as literal text
      expect(draft.project.entries[0].text).toContain(`![Missing Figure](assets/${missingSha}.png)`);
    });
  });

  // =========================================================================
  // 6. Manifest Integrity & Tampering
  // =========================================================================
  describe("6. Manifest Integrity & Manifest Tampering", () => {
    it("handles corrupted non-JSON manifest.json gracefully by warning and fallback title", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "# Title From Manuscript\n\nBody text.");
      zip.file("manifest.json", "{ invalid JSON : true ");

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "bad-manifest.zip");

      expect(draft.warnings.some((w) => w.includes("manifest.json is invalid JSON and was ignored"))).toBe(true);
      expect(draft.project.title).toBe("Title From Manuscript");
    });

    it("falls back to filename when manifest title is whitespace-only and manuscript has no H1", async () => {
      const zip = new JSZip();
      zip.file("manuscript.md", "Just a regular paragraph with no heading.");
      zip.file("manifest.json", JSON.stringify({ title: "   " }));

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "MySpecialDocument.zip");

      expect(draft.project.title).toBe("MySpecialDocument");
    });

    it("verifies manifest.json asset metadata round-trip on export", async () => {
      const { png, jpeg, assetsMap } = await createValidAssets();
      const project = newProject("Manifest Test");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { assetId: png.id, alt: "PNG image", title: null, width: null, height: null },
          },
          {
            type: "image",
            attrs: { assetId: jpeg.id, alt: "JPG image", title: null, width: null, height: null },
          },
        ],
      };

      const blob = await exportMarkdownBundle(project, assetsMap);
      const zip = await JSZip.loadAsync(await blob.arrayBuffer());
      const manifestRaw = await zip.file("manifest.json")!.async("string");
      const manifest = JSON.parse(manifestRaw) as MarkdownBundleManifest;

      expect(manifest.format).toBe("personal-word-markdown-bundle");
      expect(manifest.version).toBe(1);
      expect(manifest.title).toBe("Manifest Test");
      expect(manifest.assets).toHaveLength(2);

      const pngManifest = manifest.assets.find((a) => a.id === png.id);
      expect(pngManifest).toBeDefined();
      expect(pngManifest?.mime).toBe("image/png");
      expect(pngManifest?.byteLength).toBe(tinyPng.length);
      expect(pngManifest?.path).toBe(`assets/${png.id}.png`);

      const jpgManifest = manifest.assets.find((a) => a.id === jpeg.id);
      expect(jpgManifest).toBeDefined();
      expect(jpgManifest?.mime).toBe("image/jpeg");
      expect(jpgManifest?.byteLength).toBe(tinyJpeg.length);
      expect(jpgManifest?.path).toBe(`assets/${jpeg.id}.jpg`);
    });

    it("records behavior when manifest.json specifies an asset SHA that differs from actual asset bytes", async () => {
      const { png } = await createValidAssets();
      const fakeManifestSha = "9".repeat(64);
      const zip = new JSZip();
      zip.file("manuscript.md", `![Photo](assets/${png.id}.png)`);
      zip.file(`assets/${png.id}.png`, png.bytes);
      zip.file(
        "manifest.json",
        JSON.stringify({
          format: "personal-word-markdown-bundle",
          version: 1,
          title: "Manifest Mismatch Test",
          assets: [
            {
              id: fakeManifestSha,
              path: `assets/${png.id}.png`,
              mime: "image/png",
              byteLength: png.bytes.length,
              width: 1,
              height: 1,
            },
          ],
        }),
      );
      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "manifest-sha-mismatch.zip");

      // Verify that import succeeds because content-addressed assets/<sha>.ext is the source of truth,
      // and manifest.json is optional / metadata-only.
      expect(draft.project.title).toBe("Manifest Mismatch Test");
      expect(draft.assets[0].id).toBe(png.id);
    });
  });

  // =========================================================================
  // 7. Network Isolation & Remote Link Security (Zero Network Calls)
  // =========================================================================
  describe("7. Network Isolation & Remote Link Security", () => {
    it("ensures ZERO network calls when encountering various remote URLs in manuscript.md", async () => {
      // Spy on fetch and Node http/https
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const httpSpy = vi.spyOn(http, "request");
      const httpGetSpy = vi.spyOn(http, "get");
      const httpsSpy = vi.spyOn(https, "request");
      const httpsGetSpy = vi.spyOn(https, "get");

      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        `# Remote Links Test

Paragraph with remote images:
![HTTPS](https://malicious.example.com/exploit.png)
![HTTP](http://insecure.example.com/tracker.jpg)
![Protocol Relative](//cdn.example.org/pixel.gif)
![FTP](ftp://files.example.org/download.png)

End of document.`,
      );

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "remote-network-test.zip");

      // Verify ZERO network calls across all protocols
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(httpSpy).not.toHaveBeenCalled();
      expect(httpGetSpy).not.toHaveBeenCalled();
      expect(httpsSpy).not.toHaveBeenCalled();
      expect(httpsGetSpy).not.toHaveBeenCalled();

      // Verify no staged assets and 0 image nodes in counts
      expect(draft.assets).toHaveLength(0);
      expect(draft.counts.images).toBe(0);

      // Verify warnings generated for all remote links
      expect(draft.warnings.some((w) => w.includes("https://malicious.example.com/exploit.png"))).toBe(true);
      expect(draft.warnings.some((w) => w.includes("http://insecure.example.com/tracker.jpg"))).toBe(true);
      expect(draft.warnings.some((w) => w.includes("//cdn.example.org/pixel.gif"))).toBe(true);
      expect(draft.warnings.some((w) => w.includes("ftp://files.example.org/download.png"))).toBe(true);

      // Verify literal markdown text is preserved
      const textContent = draft.project.entries[0].text;
      expect(textContent).toContain("https://malicious.example.com/exploit.png");
      expect(textContent).toContain("http://insecure.example.com/tracker.jpg");
      expect(textContent).toContain("//cdn.example.org/pixel.gif");
      expect(textContent).toContain("ftp://files.example.org/download.png");

      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it("prevents script execution and DOM injection when manuscript.md contains raw HTML tags, relative links, or javascript links", async () => {
      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        `# Injection Vector

<script>window.__pwned = true;</script>
<img src="https://evil.example.com/csrf" onerror="window.__pwned=true;" />
<iframe src="javascript:alert(1)"></iframe>
[Malicious Link](javascript:alert('xss'))
[Relative Link](../secret.md)

Normal text follows.`,
      );

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "xss-injection.zip");

      // Verify no script or iframe nodes created in TipTap document AST
      const contentStr = JSON.stringify(draft.project.entries[0].content);
      expect(contentStr).not.toContain('"type":"script"');
      expect(contentStr).not.toContain('"type":"iframe"');
      // Relative links trigger the unsupported link warning and are retained as text
      expect(draft.warnings.some((w) => w.includes("Relative or unsupported links are retained as text"))).toBe(true);
      // javascript: link is blocked by markdown-it URL sanitizer and retained as literal text without executing
      expect(draft.project.entries[0].text).toContain("javascript:alert('xss')");
      // Window should not be polluted
      expect((globalThis as any).__pwned).toBeUndefined();
    });
  });

  // =========================================================================
  // 8. Robustness & Complex Formatting Cases
  // =========================================================================
  describe("8. Robustness & Format Variations", () => {
    it("handles uppercase asset extensions and mixed-case hex filename", async () => {
      const { png } = await createValidAssets();
      const upperSha = png.id.toUpperCase();

      const zip = new JSZip();
      zip.file("manuscript.md", `# Upper\n\n![Pic](assets/${upperSha}.PNG)`);
      zip.file(`assets/${upperSha}.PNG`, png.bytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "uppercase-ext.zip");

      expect(draft.assets).toHaveLength(1);
      expect(draft.assets[0].id).toBe(png.id); // lowercased
      expect(draft.counts.images).toBe(1);
    });

    it("deduplicates asset staging when the same asset is referenced multiple times in manuscript", async () => {
      const { png } = await createValidAssets();

      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        `# Multi Reference

![Pic 1](assets/${png.id}.png)

Paragraph in between.

![Pic 2](assets/${png.id}.png)

Another paragraph.

![Pic 3](assets/${png.id}.png)`,
      );
      zip.file(`assets/${png.id}.png`, png.bytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "multi-ref.zip");

      expect(draft.counts.images).toBe(3);
      expect(draft.assets).toHaveLength(1); // Exactly 1 staged asset in draft.assets
      expect(draft.assets[0].id).toBe(png.id);
    });

    it("equalizes ragged GFM pipe tables into a valid rectangular grid", async () => {
      const zip = new JSZip();
      zip.file(
        "manuscript.md",
        `# Ragged Table

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| Only One Cell |
| Cell 2A | Cell 2B |
| Cell 3A | Cell 3B | Cell 3C |
`,
      );

      const bytes = await zip.generateAsync({ type: "uint8array" });
      const draft = await importMarkdownBundle(bytes, "ragged-table.zip");

      expect(draft.counts.tables).toBe(1);
      const tableNode = (draft.project.entries[0].content as any).content.find(
        (n: any) => n.type === "table",
      );
      expect(tableNode).toBeDefined();
      const rows = tableNode.content;
      expect(rows).toHaveLength(4); // header + 3 body rows
      // Every row must have exactly 3 cells
      for (const row of rows) {
        expect(row.content).toHaveLength(3);
      }
    });
  });

  // =========================================================================
  // 8. Missing Asset Guard on Export
  // =========================================================================
  describe("8. Missing Asset Guard on Export", () => {
    it("throws immediate actionable error if a referenced asset is missing from the assets map", async () => {
      const missingId: AssetId = "c".repeat(64);
      const project: ExportProject = newProject("Missing Asset Project");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { assetId: missingId, alt: "Missing", title: null, width: null, height: null },
          },
        ],
      };

      const emptyMap = new Map<AssetId, PendingAsset>();
      await expect(exportMarkdownBundle(project, emptyMap)).rejects.toThrow(
        `An image is missing from this export (asset ${missingId.slice(0, 12)}). Restore the image or remove it from the document before exporting.`,
      );
    });

    it("throws immediate actionable error if multiple assets are referenced and any one is missing", async () => {
      const { png } = await createValidAssets();
      const missingId: AssetId = "d".repeat(64);
      const project: ExportProject = newProject("Partial Asset Project");
      project.entries[0].content = {
        type: "doc",
        content: [
          {
            type: "image",
            attrs: { assetId: png.id, alt: "Present", title: null, width: null, height: null },
          },
          {
            type: "image",
            attrs: { assetId: missingId, alt: "Missing", title: null, width: null, height: null },
          },
        ],
      };

      // Only png is in the map; missingId is not
      const partialMap = new Map<AssetId, PendingAsset>([[png.id, png]]);
      await expect(exportMarkdownBundle(project, partialMap)).rejects.toThrow(
        `An image is missing from this export (asset ${missingId.slice(0, 12)}). Restore the image or remove it from the document before exporting.`,
      );
    });
  });

  // =========================================================================
  // 9. Cancellation via AbortSignal
  // =========================================================================
  describe("9. Cancellation via AbortSignal", () => {
    it("aborts pre-inflation immediately when AbortSignal is already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const zip = new JSZip();
      zip.file("manuscript.md", "# Aborted Immediately");
      const bytes = await zip.generateAsync({ type: "uint8array" });

      await expect(
        importMarkdownBundle(bytes, "pre-aborted.zip", { signal: controller.signal }),
      ).rejects.toThrow(/Import operation aborted/i);
    });

    it("honors AbortSignal between validation stages", async () => {
      const controller = new AbortController();
      const zip = new JSZip();
      zip.file("manuscript.md", "# Mid abort");
      const { png } = await createValidAssets();
      zip.file(`assets/${png.id}.png`, png.bytes);

      const bytes = await zip.generateAsync({ type: "uint8array" });

      // Abort after 0ms timeout (during asynchronous bundle processing)
      setTimeout(() => controller.abort(), 0);

      try {
        await importMarkdownBundle(bytes, "mid-aborted.zip", { signal: controller.signal });
      } catch (err: any) {
        expect(err.name === "AbortError" || /aborted/i.test(err.message)).toBe(true);
      }
    });
  });
});
