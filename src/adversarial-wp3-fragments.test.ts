import { describe, it, expect, vi } from "vitest";
import { entry, newProject, type Entry } from "./model";
import {
  copyFragmentAssets,
  importFragmentWithAssets,
  importFragment,
  type FragmentAssetStorage,
} from "./organization/operations";
import {
  createPendingAsset,
  collectAssetIds,
  toBase64,
  sha256Hex,
} from "./assets/assets";
import type { PendingAsset } from "./assets/types";
import {
  createProjectArchive,
  readProjectArchive,
} from "./projectArchive";

// Fixture helpers
const pngBytes = (w: number, h: number, tail = 0): Uint8Array => {
  const b = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
    0, 0, w >> 8, w & 255, 0, 0, h >> 8, h & 255,
    8, 2, 0, 0, 0, 0, 0, 0, 0,
  ];
  const out = new Uint8Array(b.length + tail);
  out.set(b);
  return out;
};

const jpegBytes = (w: number, h: number): Uint8Array => {
  return new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x00, 0x03, 0x11, 0x00,
    0xff, 0xd9,
  ]);
};

describe("Adversarial WP3 Test Suite — Fragments & Archive Durability", () => {
  // =========================================================================
  // CATEGORY 1: Missing Assets in Storage & Atomic Abort (No Partial Staging)
  // =========================================================================
  describe("Category 1: Missing Asset in Storage & Atomic Abort", () => {
    it("fails cleanly and aborts staging without partial leak when 1 of 5 assets is missing", async () => {
      const target = newProject("Target Project");
      const source = newProject("Source Project");

      const a1 = await createPendingAsset(pngBytes(10, 10));
      const a2 = await createPendingAsset(pngBytes(20, 20));
      const a3 = await createPendingAsset(pngBytes(30, 30));
      const a4 = await createPendingAsset(pngBytes(40, 40));
      const a5 = await createPendingAsset(pngBytes(50, 50));

      // Source store has 4 of 5 assets; a3 is MISSING.
      const sourceStore = new Map<string, PendingAsset>([
        [a1.id, a1],
        [a2.id, a2],
        // a3 missing!
        [a4.id, a4],
        [a5.id, a5],
      ]);
      const targetStore = new Map<string, PendingAsset>();

      const stageAssetsMock = vi.fn(async (projectId: string, assets: PendingAsset[]) => {
        if (projectId === target.id) {
          for (const a of assets) targetStore.set(a.id, a);
        }
      });

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async (projectId: string, id: string) => {
          if (projectId === source.id && sourceStore.has(id)) {
            return sourceStore.get(id)!;
          }
          throw new Error(`Asset ${id} is not stored in source project.`);
        }),
        stageAssets: stageAssetsMock,
      };

      const frag = entry("fragment", "Multi-Image Fragment");
      frag.content = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Paragraph 1" }] },
          { type: "image", attrs: { assetId: a1.id, alt: "1" } },
          { type: "image", attrs: { assetId: a2.id, alt: "2" } },
          { type: "image", attrs: { assetId: a3.id, alt: "3 (missing)" } },
          { type: "image", attrs: { assetId: a4.id, alt: "4" } },
          { type: "image", attrs: { assetId: a5.id, alt: "5" } },
        ],
      };

      await expect(
        copyFragmentAssets(target.id, source.id, frag, mockStorage),
      ).rejects.toThrow(`Asset ${a3.id} is not stored in source project.`);

      // CRITICAL ATOMICITY CHECK: stageAssets must NEVER be called, even for a1, a2, a4, a5!
      expect(stageAssetsMock).not.toHaveBeenCalled();
      expect(targetStore.size).toBe(0);
    });

    it("ensures importFragmentWithAssets leaves target project strictly unmodified on read failure", async () => {
      const target = newProject("Pristine Target");
      const source = newProject("Source");
      const asset = await createPendingAsset(pngBytes(16, 16));

      const originalEntriesCount = target.entries.length;
      const originalResearch = structuredClone(target.research);
      const originalRevision = target.revision;

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => {
          throw new Error("I/O error reading asset from disk");
        }),
        stageAssets: vi.fn(async () => {}),
      };

      const frag = entry("fragment", "Failing Fragment");
      frag.content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id, alt: "Test" } }],
      };

      await expect(
        importFragmentWithAssets(target, source, frag, mockStorage),
      ).rejects.toThrow("I/O error reading asset from disk");

      // Verify target project state is untouched
      expect(target.entries.length).toBe(originalEntriesCount);
      expect(target.research).toEqual(originalResearch);
      expect(target.revision).toBe(originalRevision);
      expect(mockStorage.stageAssets).not.toHaveBeenCalled();
    });

    it("propagates storage staging failures without committing fragment entry to target", async () => {
      const target = newProject("Target");
      const source = newProject("Source");
      const asset = await createPendingAsset(pngBytes(12, 12));

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => asset),
        stageAssets: vi.fn(async () => {
          throw new Error("Disk quota exceeded on target storage");
        }),
      };

      const frag = entry("fragment", "Staging Failure");
      frag.content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id, alt: "Quota" } }],
      };

      await expect(
        importFragmentWithAssets(target, source, frag, mockStorage),
      ).rejects.toThrow("Disk quota exceeded on target storage");

      // The target was passed into importFragmentWithAssets; ensure target wasn't modified
      expect(target.entries.length).toBe(1);
    });
  });

  // =========================================================================
  // CATEGORY 2: Duplicate Asset IDs and Shared Assets
  // =========================================================================
  describe("Category 2: Duplicate Asset IDs & Shared Assets", () => {
    it("deduplicates repeated asset IDs across multiple nodes so storage is only called once per unique asset", async () => {
      const target = newProject("Target");
      const source = newProject("Source");

      const assetA = await createPendingAsset(pngBytes(10, 10));
      const assetB = await createPendingAsset(jpegBytes(20, 20));

      const readAssetMock = vi.fn(async (_projectId: string, id: string) => {
        if (id === assetA.id) return assetA;
        if (id === assetB.id) return assetB;
        throw new Error("Not found");
      });

      const stageAssetsMock = vi.fn(
        async (_projectId: string, _assets: PendingAsset[]) => {},
      );

      const mockStorage: FragmentAssetStorage = {
        readAsset: readAssetMock,
        stageAssets: stageAssetsMock,
      };

      // Fragment references assetA 4 times and assetB 3 times across various blocks
      const frag = entry("fragment", "Duplicated References");
      frag.content = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Section 1" }] },
          { type: "image", attrs: { assetId: assetA.id, alt: "A1" } },
          { type: "image", attrs: { assetId: assetB.id, alt: "B1" } },
          { type: "paragraph", content: [{ type: "text", text: "Section 2" }] },
          { type: "image", attrs: { assetId: assetA.id, alt: "A2" } },
          { type: "image", attrs: { assetId: assetA.id, alt: "A3" } },
          { type: "image", attrs: { assetId: assetB.id, alt: "B2" } },
          { type: "image", attrs: { assetId: assetA.id, alt: "A4" } },
          { type: "image", attrs: { assetId: assetB.id, alt: "B3" } },
        ],
      };

      const result = await copyFragmentAssets(target.id, source.id, frag, mockStorage);

      // Must only return 2 assets (one for A, one for B)
      expect(result).toHaveLength(2);
      expect(new Set(result.map((a) => a.id))).toEqual(new Set([assetA.id, assetB.id]));

      // readAsset should be called exactly twice: once for assetA, once for assetB
      expect(readAssetMock).toHaveBeenCalledTimes(2);
      expect(readAssetMock).toHaveBeenCalledWith(source.id, assetA.id);
      expect(readAssetMock).toHaveBeenCalledWith(source.id, assetB.id);

      // stageAssets should receive exactly 2 assets
      expect(stageAssetsMock).toHaveBeenCalledTimes(1);
      const stagedArg = stageAssetsMock.mock.calls[0][1];
      expect(stagedArg).toHaveLength(2);

      // Now import fragment and verify all 7 image nodes remain in the document
      const imported = importFragment(target, source, frag);
      const copiedEntry = imported.entries.at(-1)!;
      const imagesInImported = copiedEntry.content.content!.filter((n) => n.type === "image");
      expect(imagesInImported).toHaveLength(7);
      expect(imagesInImported.filter((n) => n.attrs?.assetId === assetA.id)).toHaveLength(4);
      expect(imagesInImported.filter((n) => n.attrs?.assetId === assetB.id)).toHaveLength(3);
    });

    it("safely handles importing when target project already contains the same asset (idempotency)", async () => {
      const target = newProject("Target");
      const source = newProject("Source");
      const sharedAsset = await createPendingAsset(pngBytes(14, 14));

      // Simulate target storage already holding sharedAsset
      const targetStore = new Map<string, PendingAsset>([[sharedAsset.id, sharedAsset]]);

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => sharedAsset),
        stageAssets: vi.fn(async (_proj, assets) => {
          for (const a of assets) targetStore.set(a.id, a);
        }),
      };

      const frag = entry("fragment", "Shared Asset Fragment");
      frag.content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: sharedAsset.id, alt: "Shared" } }],
      };

      const res = await importFragmentWithAssets(target, source, frag, mockStorage);

      expect(targetStore.has(sharedAsset.id)).toBe(true);
      expect(res.entries.at(-1)?.content.content?.[0].attrs?.assetId).toBe(sharedAsset.id);
    });

    it("handles sequential fragment imports sharing common assets without collision", async () => {
      const target = newProject("Target");
      const source1 = newProject("Source 1");
      const source2 = newProject("Source 2");

      const assetCommon = await createPendingAsset(pngBytes(12, 12));
      const assetUnique1 = await createPendingAsset(pngBytes(14, 14));
      const assetUnique2 = await createPendingAsset(jpegBytes(16, 16));

      const targetStore = new Map<string, PendingAsset>();

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async (_proj, id) => {
          if (id === assetCommon.id) return assetCommon;
          if (id === assetUnique1.id) return assetUnique1;
          if (id === assetUnique2.id) return assetUnique2;
          throw new Error("Asset not found");
        }),
        stageAssets: vi.fn(async (_proj, assets) => {
          for (const a of assets) targetStore.set(a.id, a);
        }),
      };

      const frag1 = entry("fragment", "Frag 1");
      frag1.content = {
        type: "doc",
        content: [
          { type: "image", attrs: { assetId: assetCommon.id, alt: "Common" } },
          { type: "image", attrs: { assetId: assetUnique1.id, alt: "U1" } },
        ],
      };

      const frag2 = entry("fragment", "Frag 2");
      frag2.content = {
        type: "doc",
        content: [
          { type: "image", attrs: { assetId: assetCommon.id, alt: "Common" } },
          { type: "image", attrs: { assetId: assetUnique2.id, alt: "U2" } },
        ],
      };

      const p1 = await importFragmentWithAssets(target, source1, frag1, mockStorage);
      const p2 = await importFragmentWithAssets(p1, source2, frag2, mockStorage);

      expect(p2.entries.length).toBe(3); // Initial section + 2 fragments
      expect(targetStore.size).toBe(3); // assetCommon, assetUnique1, assetUnique2
      expect(targetStore.has(assetCommon.id)).toBe(true);
      expect(targetStore.has(assetUnique1.id)).toBe(true);
      expect(targetStore.has(assetUnique2.id)).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 3: Deep Nested Nodes Containing Multiple Images
  // =========================================================================
  describe("Category 3: Deep Nested Nodes Containing Multiple Images", () => {
    it("finds all assets in complex, highly-nested structures (tables, lists, blockquotes)", async () => {
      const target = newProject("Target");
      const source = newProject("Source");

      const imgA = await createPendingAsset(pngBytes(8, 8));
      const imgB = await createPendingAsset(jpegBytes(12, 12));
      const imgC = await createPendingAsset(pngBytes(16, 16));
      const imgD = await createPendingAsset(jpegBytes(24, 24));

      const sourceAssets = new Map([
        [imgA.id, imgA],
        [imgB.id, imgB],
        [imgC.id, imgC],
        [imgD.id, imgD],
      ]);

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async (_proj, id) => {
          const a = sourceAssets.get(id);
          if (!a) throw new Error("Missing");
          return a;
        }),
        stageAssets: vi.fn(async () => {}),
      };

      // Construct deeply nested AST:
      // doc -> blockquote -> bulletList -> listItem -> table -> tableRow -> tableCell -> paragraph -> image
      const frag = entry("fragment", "Deep Tree");
      frag.content = {
        type: "doc",
        content: [
          {
            type: "blockquote",
            content: [
              {
                type: "bulletList",
                content: [
                  {
                    type: "listItem",
                    content: [
                      {
                        type: "table",
                        content: [
                          {
                            type: "tableRow",
                            content: [
                              {
                                type: "tableCell",
                                content: [
                                  {
                                    type: "paragraph",
                                    content: [
                                      { type: "text", text: "Nested Cell" },
                                      { type: "image", attrs: { assetId: imgA.id, alt: "Deep A" } },
                                    ],
                                  },
                                ],
                              },
                              {
                                type: "tableCell",
                                content: [
                                  {
                                    type: "blockquote",
                                    content: [
                                      {
                                        type: "paragraph",
                                        content: [
                                          { type: "image", attrs: { assetId: imgB.id, alt: "Deep B" } },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          // Empty nodes and malformed content mixed in
          { type: "paragraph", content: [] },
          { type: "customBlock", content: null as any },
          {
            type: "orderedList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [
                      { type: "image", attrs: { assetId: imgC.id, alt: "Deep C" } },
                      { type: "image", attrs: { assetId: imgD.id, alt: "Deep D" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const staged = await copyFragmentAssets(target.id, source.id, frag, mockStorage);
      expect(staged).toHaveLength(4);
      expect(new Set(staged.map((a) => a.id))).toEqual(
        new Set([imgA.id, imgB.id, imgC.id, imgD.id]),
      );

      const imported = importFragment(target, source, frag);
      const copiedEntry = imported.entries.at(-1)!;

      // Verify the deep structure was fully cloned
      const idsFound = collectAssetIds(copiedEntry.content);
      expect(idsFound).toEqual(new Set([imgA.id, imgB.id, imgC.id, imgD.id]));
    });

    it("handles extreme recursion depth (75 levels deep) without call-stack overflow", async () => {
      const target = newProject("Target");
      const source = newProject("Source");
      const deepAsset = await createPendingAsset(pngBytes(20, 20));

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => deepAsset),
        stageAssets: vi.fn(async () => {}),
      };

      // Wrap an image node inside 75 levels of wrapper objects
      let currentInner: any = {
        type: "image",
        attrs: { assetId: deepAsset.id, alt: "Abyssal Image" },
      };

      for (let depth = 0; depth < 75; depth++) {
        currentInner = {
          type: depth % 2 === 0 ? "blockquote" : "customWrapper",
          content: [currentInner],
        };
      }

      const frag = entry("fragment", "Extreme Depth");
      frag.content = {
        type: "doc",
        content: [currentInner],
      };

      const staged = await copyFragmentAssets(target.id, source.id, frag, mockStorage);
      expect(staged).toHaveLength(1);
      expect(staged[0].id).toBe(deepAsset.id);

      const imported = importFragment(target, source, frag);
      const foundIds = collectAssetIds(imported.entries.at(-1)!.content);
      expect(foundIds.has(deepAsset.id)).toBe(true);
    });

    it("safely ignores non-image nodes, empty nodes, null content, and corrupted AST entries", () => {
      const noisyContent = {
        type: "doc",
        content: [
          null,
          undefined,
          123,
          "just a string",
          { notType: "something" },
          { type: "image", attrs: null },
          { type: "image", attrs: { assetId: 999 } }, // non-string assetId
          { type: "paragraph", content: "not-an-array" },
          { type: "paragraph", content: [{ type: "image", attrs: {} }] },
        ],
      };

      const ids = collectAssetIds(noisyContent as any);
      expect(ids.size).toBe(0);
    });
  });

  // =========================================================================
  // CATEGORY 4: Archive Import with Corrupted Asset Payload or Mismatching SHA-256
  // =========================================================================
  describe("Category 4: Archive Import with Corrupted Asset Payload or Mismatching SHA-256", () => {
    it("rejects archive when asset data is corrupted non-base64", async () => {
      const asset = await createPendingAsset(pngBytes(10, 10));
      const p = newProject("Corrupted Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      const corruptedArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: asset.id,
            meta: asset.meta,
            data: "ThisIsNotValidBase64!!@@##$$",
          },
        ],
      });

      await expect(readProjectArchive(corruptedArchive)).rejects.toThrow(
        /Image data is not valid base64/,
      );
    });

    it("rejects archive when payload bytes do not match declared SHA-256 asset ID (tampering)", async () => {
      const asset = await createPendingAsset(pngBytes(12, 12));
      const p = newProject("Tampered Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      // Corrupt 1 byte in the PNG body
      const tamperedBytes = asset.bytes.slice();
      tamperedBytes[20] ^= 0xff;

      const tamperedArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: asset.id, // original hash
            meta: asset.meta,
            data: toBase64(tamperedBytes), // altered bytes
          },
        ],
      });

      await expect(readProjectArchive(tamperedArchive)).rejects.toThrow(
        /Image bytes do not match their identifier/,
      );
    });

    it("rejects archive when metadata dimensions or mime type are forged", async () => {
      const asset = await createPendingAsset(pngBytes(16, 16));
      const p = newProject("Forged Meta Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      // Lie about width in metadata
      const forgedWidthArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: asset.id,
            meta: { ...asset.meta, width: 9999 },
            data: toBase64(asset.bytes),
          },
        ],
      });

      await expect(readProjectArchive(forgedWidthArchive)).rejects.toThrow(
        /Image type or size does not match its contents/,
      );

      // Lie about MIME type in metadata
      const forgedMimeArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: asset.id,
            meta: { ...asset.meta, mime: "image/jpeg" },
            data: toBase64(asset.bytes),
          },
        ],
      });

      await expect(readProjectArchive(forgedMimeArchive)).rejects.toThrow(
        /Image type or size does not match its contents/,
      );
    });

    it("rejects archive when referenced image is completely missing from assets array", async () => {
      const asset = await createPendingAsset(pngBytes(10, 10));
      const p = newProject("Missing Image Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      const missingAssetArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [], // empty assets list
      });

      await expect(readProjectArchive(missingAssetArchive)).rejects.toThrow(
        new RegExp(`Project archive is missing image ${asset.id.slice(0, 8)}`),
      );
    });

    it("rejects archive containing duplicate asset records in the assets list", async () => {
      const asset = await createPendingAsset(pngBytes(10, 10));
      const p = newProject("Duplicate Assets Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      const record = {
        id: asset.id,
        meta: asset.meta,
        data: toBase64(asset.bytes),
      };

      const dupArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [record, record],
      });

      await expect(readProjectArchive(dupArchive)).rejects.toThrow(
        /Project archive lists the same image twice/,
      );
    });

    it("simulates atomic import failure in App.tsx (storage.createProjectWithAssets never called on corrupt archive)", async () => {
      const asset = await createPendingAsset(pngBytes(10, 10));
      const p = newProject("Project");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: asset.id } }],
      };

      const corruptedArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [{ id: asset.id, meta: asset.meta, data: "corrupted!!!" }],
      });

      const createProjectWithAssetsMock = vi.fn(
        async (_imported: unknown, _assets: unknown) => {},
      );

      // Simulate App.tsx importProject flow:
      const simulateImport = async (text: string) => {
        const { project: imported, assets } = await readProjectArchive(text);
        await createProjectWithAssetsMock(imported, assets);
      };

      await expect(simulateImport(corruptedArchive)).rejects.toThrow();
      expect(createProjectWithAssetsMock).not.toHaveBeenCalled();
    });

    it("round-trips archive cleanly with both PNG and JPEG images", async () => {
      const pngAsset = await createPendingAsset(pngBytes(32, 24, 200));
      const jpegAsset = await createPendingAsset(jpegBytes(48, 36));

      const p = newProject("Full Roundtrip");
      p.entries[0].content = {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Photo and Diagram" }] },
          { type: "image", attrs: { assetId: pngAsset.id, alt: "Diagram" } },
          { type: "image", attrs: { assetId: jpegAsset.id, alt: "Photo" } },
        ],
      };

      const assetMap = new Map([
        [pngAsset.id, pngAsset],
        [jpegAsset.id, jpegAsset],
      ]);

      const archiveText = await createProjectArchive(p, async (id) => {
        const a = assetMap.get(id);
        if (!a) throw new Error("Not found");
        return a;
      });

      const { project: restoredProject, assets: restoredAssets, ignoredAssetIds } =
        await readProjectArchive(archiveText);

      expect(restoredProject.id).toBe(p.id);
      expect(restoredAssets).toHaveLength(2);
      expect(ignoredAssetIds).toHaveLength(0);

      const restoredPng = restoredAssets.find((a) => a.id === pngAsset.id)!;
      const restoredJpeg = restoredAssets.find((a) => a.id === jpegAsset.id)!;

      expect(restoredPng.meta).toEqual(pngAsset.meta);
      expect(restoredPng.bytes).toEqual(pngAsset.bytes);

      expect(restoredJpeg.meta).toEqual(jpegAsset.meta);
      expect(restoredJpeg.bytes).toEqual(jpegAsset.bytes);
    });
  });

  // =========================================================================
  // CATEGORY 5: Concurrent Fragment Imports & High Concurrency Stress
  // =========================================================================
  describe("Category 5: Concurrent Fragment Imports & Concurrency Stress", () => {
    it("handles 20 concurrent fragment imports simultaneously into the same project storage without data corruption", async () => {
      const target = newProject("Concurrent Target");
      const source = newProject("Source");

      // Generate 20 distinct assets and 20 distinct fragments
      const assets: PendingAsset[] = [];
      const fragments: Entry[] = [];

      for (let i = 0; i < 20; i++) {
        const asset = await createPendingAsset(pngBytes(10 + i, 10 + i, i * 10));
        assets.push(asset);

        const f = entry("fragment", `Fragment ${i}`);
        f.content = {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: `Content ${i}` }] },
            { type: "image", attrs: { assetId: asset.id, alt: `Img ${i}` } },
          ],
        };
        fragments.push(f);
      }

      const sourceStore = new Map<string, PendingAsset>(assets.map((a) => [a.id, a]));
      const targetStore = new Map<string, PendingAsset>();

      // Mock storage with artificial random async latency (1-5ms) to provoke race conditions
      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async (_proj, id) => {
          await new Promise((r) => setTimeout(r, Math.random() * 5 + 1));
          const a = sourceStore.get(id);
          if (!a) throw new Error("Asset not found");
          return a;
        }),
        stageAssets: vi.fn(async (_proj, newAssets) => {
          await new Promise((r) => setTimeout(r, Math.random() * 5 + 1));
          for (const a of newAssets) {
            targetStore.set(a.id, a);
          }
        }),
      };

      // Launch all 20 fragment asset copies concurrently
      const results = await Promise.all(
        fragments.map((frag) =>
          copyFragmentAssets(target.id, source.id, frag, mockStorage),
        ),
      );

      // Verify each call returned its respective asset
      expect(results).toHaveLength(20);
      results.forEach((stagedList, idx) => {
        expect(stagedList).toHaveLength(1);
        expect(stagedList[0].id).toBe(assets[idx].id);
      });

      // Verify all 20 unique assets were successfully staged in target store
      expect(targetStore.size).toBe(20);
      for (const a of assets) {
        expect(targetStore.has(a.id)).toBe(true);
      }

      // Now simulate concurrent importFragment calls applied functionally
      let updatedProject = target;
      for (const frag of fragments) {
        updatedProject = importFragment(updatedProject, source, frag);
      }

      // Total entries: 1 original section + 20 imported fragments = 21
      expect(updatedProject.entries).toHaveLength(21);

      // Verify all 20 imported entries received unique IDs
      const importedEntryIds = updatedProject.entries.slice(1).map((e) => e.id);
      expect(new Set(importedEntryIds).size).toBe(20);
    });

    it("handles concurrent imports referencing identical shared assets without race condition or duplication", async () => {
      const target = newProject("Shared Target");
      const source = newProject("Source");
      const sharedAsset = await createPendingAsset(pngBytes(15, 15));

      const targetStore = new Map<string, PendingAsset>();

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 2));
          return sharedAsset;
        }),
        stageAssets: vi.fn(async (_proj, assets) => {
          await new Promise((r) => setTimeout(r, 2));
          for (const a of assets) targetStore.set(a.id, a);
        }),
      };

      // 10 fragments all referencing the same shared asset
      const fragments = Array.from({ length: 10 }, (_, i) => {
        const f = entry("fragment", `Frag ${i}`);
        f.content = {
          type: "doc",
          content: [{ type: "image", attrs: { assetId: sharedAsset.id, alt: "Shared" } }],
        };
        return f;
      });

      await Promise.all(
        fragments.map((frag) =>
          copyFragmentAssets(target.id, source.id, frag, mockStorage),
        ),
      );

      expect(targetStore.size).toBe(1);
      expect(targetStore.get(sharedAsset.id)).toEqual(sharedAsset);
    });

    it("isolates errors when 1 of 5 concurrent imports fails (failure in one does not corrupt others)", async () => {
      const target = newProject("Target");
      const source = newProject("Source");

      const validAsset1 = await createPendingAsset(pngBytes(10, 10));
      const validAsset2 = await createPendingAsset(pngBytes(20, 20));
      const validAsset3 = await createPendingAsset(pngBytes(30, 30));
      const validAsset4 = await createPendingAsset(pngBytes(40, 40));
      const missingAsset = await createPendingAsset(pngBytes(50, 50));

      const sourceStore = new Map<string, PendingAsset>([
        [validAsset1.id, validAsset1],
        [validAsset2.id, validAsset2],
        [validAsset3.id, validAsset3],
        [validAsset4.id, validAsset4],
        // missingAsset omitted!
      ]);

      const targetStore = new Map<string, PendingAsset>();

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async (_proj, id) => {
          const a = sourceStore.get(id);
          if (!a) throw new Error(`Missing asset ${id}`);
          return a;
        }),
        stageAssets: vi.fn(async (_proj, assets) => {
          for (const a of assets) targetStore.set(a.id, a);
        }),
      };

      const makeFrag = (assetId: string, name: string) => {
        const f = entry("fragment", name);
        f.content = {
          type: "doc",
          content: [{ type: "image", attrs: { assetId, alt: name } }],
        };
        return f;
      };

      const frags = [
        makeFrag(validAsset1.id, "Valid 1"),
        makeFrag(validAsset2.id, "Valid 2"),
        makeFrag(missingAsset.id, "Failing"),
        makeFrag(validAsset3.id, "Valid 3"),
        makeFrag(validAsset4.id, "Valid 4"),
      ];

      const outcomes = await Promise.allSettled(
        frags.map((f) => copyFragmentAssets(target.id, source.id, f, mockStorage)),
      );

      expect(outcomes[0].status).toBe("fulfilled");
      expect(outcomes[1].status).toBe("fulfilled");
      expect(outcomes[2].status).toBe("rejected"); // The failing one!
      expect(outcomes[3].status).toBe("fulfilled");
      expect(outcomes[4].status).toBe("fulfilled");

      // Verify the failing one rejected with the expected missing asset message
      if (outcomes[2].status === "rejected") {
        expect((outcomes[2].reason as Error).message).toContain(`Missing asset ${missingAsset.id}`);
      }

      // Verify that the 4 successful imports staged their assets into targetStore
      expect(targetStore.size).toBe(4);
      expect(targetStore.has(validAsset1.id)).toBe(true);
      expect(targetStore.has(validAsset2.id)).toBe(true);
      expect(targetStore.has(validAsset3.id)).toBe(true);
      expect(targetStore.has(validAsset4.id)).toBe(true);
      expect(targetStore.has(missingAsset.id)).toBe(false);
    });

    it("handles 10 concurrent fragment imports combining both image assets and remapped footnotes without ID collision", async () => {
      const target = newProject("Target with Footnotes");
      const source = newProject("Source with Research");

      source.research = {
        sources: [
          { id: "src-book-1", kind: "book", title: "Shared Book", authors: ["Author A"] },
        ],
        notes: [],
        footnotes: [
          { id: "fn-source-1", text: "Source citation", sourceId: "src-book-1" },
        ],
      };

      const sharedAsset = await createPendingAsset(pngBytes(18, 18));
      const targetStore = new Map<string, PendingAsset>();

      const mockStorage: FragmentAssetStorage = {
        readAsset: vi.fn(async () => {
          await new Promise((r) => setTimeout(r, 2));
          return sharedAsset;
        }),
        stageAssets: vi.fn(async (_proj, assets) => {
          await new Promise((r) => setTimeout(r, 2));
          for (const a of assets) targetStore.set(a.id, a);
        }),
      };

      // 10 fragments each with the image AND a footnote reference
      const fragments = Array.from({ length: 10 }, (_, i) => {
        const f = entry("fragment", `Combo Frag ${i}`);
        f.content = {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: `Citation ${i}: ` },
                { type: "footnoteReference", attrs: { id: "fn-source-1" } },
              ],
            },
            { type: "image", attrs: { assetId: sharedAsset.id, alt: `Combo ${i}` } },
          ],
        };
        return f;
      });

      // Stage assets concurrently
      await Promise.all(
        fragments.map((frag) =>
          copyFragmentAssets(target.id, source.id, frag, mockStorage),
        ),
      );

      // Apply imports functionally
      let updated = target;
      for (const frag of fragments) {
        updated = importFragment(updated, source, frag);
      }

      // Check results
      expect(targetStore.size).toBe(1);
      expect(targetStore.has(sharedAsset.id)).toBe(true);

      // Verify that each imported fragment has its footnote remapped to a unique ID
      const remappedFootnoteIds = new Set<string>();
      for (let i = 1; i <= 10; i++) {
        const fragEntry = updated.entries[i];
        const fnNode = fragEntry.content.content?.[0].content?.[1];
        const remappedId = fnNode?.attrs?.id;
        expect(remappedId).toBeDefined();
        expect(remappedId).not.toBe("fn-source-1");
        expect(remappedFootnoteIds.has(remappedId!)).toBe(false);
        remappedFootnoteIds.add(remappedId!);
      }

      expect(remappedFootnoteIds.size).toBe(10);
      expect(updated.research?.footnotes).toHaveLength(10);
    });
  });

  // =========================================================================
  // CATEGORY 6: Archive Extra Edge Cases & Format Integrity
  // =========================================================================
  describe("Category 6: Archive Extra Edge Cases & Format Integrity", () => {
    it("rejects archive containing unsupported image format (e.g. GIF or arbitrary binary data disguised as asset)", async () => {
      // Create arbitrary bytes with matching SHA-256 (not PNG, not JPEG)
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x00, 0x10, 0x00]);
      const gifHash = await sha256Hex(gifBytes);

      const p = newProject("GIF Archive");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: gifHash } }],
      };

      const gifArchive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: gifHash,
            meta: { mime: "image/gif", byteLength: gifBytes.length, width: 16, height: 16 },
            data: toBase64(gifBytes),
          },
        ],
      });

      await expect(readProjectArchive(gifArchive)).rejects.toThrow(
        /Only PNG and JPEG images are supported/,
      );
    });

    it("correctly segregates unreferenced assets in archive into ignoredAssetIds", async () => {
      const referencedAsset = await createPendingAsset(pngBytes(10, 10));
      const unreferencedAsset1 = await createPendingAsset(pngBytes(20, 20));
      const unreferencedAsset2 = await createPendingAsset(jpegBytes(30, 30));

      const p = newProject("Unreferenced Test");
      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: referencedAsset.id } }],
      };

      const archive = JSON.stringify({
        format: "personal-word",
        version: 2,
        project: p,
        assets: [
          {
            id: referencedAsset.id,
            meta: referencedAsset.meta,
            data: toBase64(referencedAsset.bytes),
          },
          {
            id: unreferencedAsset1.id,
            meta: unreferencedAsset1.meta,
            data: toBase64(unreferencedAsset1.bytes),
          },
          {
            id: unreferencedAsset2.id,
            meta: unreferencedAsset2.meta,
            data: toBase64(unreferencedAsset2.bytes),
          },
        ],
      });

      const result = await readProjectArchive(archive);
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].id).toBe(referencedAsset.id);
      expect(new Set(result.ignoredAssetIds)).toEqual(
        new Set([unreferencedAsset1.id, unreferencedAsset2.id]),
      );
    });

    it("deduplicates asset entries in createProjectArchive when multiple entries share the same image", async () => {
      const sharedAsset = await createPendingAsset(pngBytes(25, 25));

      const p = newProject("Multi-Entry Shared");
      const frag1 = entry("fragment", "Frag 1");
      const frag2 = entry("fragment", "Frag 2");

      p.entries[0].content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: sharedAsset.id } }],
      };
      frag1.content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: sharedAsset.id } }],
      };
      frag2.content = {
        type: "doc",
        content: [{ type: "image", attrs: { assetId: sharedAsset.id } }],
      };

      p.entries.push(frag1, frag2);

      const archiveText = await createProjectArchive(p, async () => sharedAsset);
      const parsedArchive = JSON.parse(archiveText);

      // Despite being in 3 entries, the archive assets list must only contain 1 entry
      expect(parsedArchive.assets).toHaveLength(1);
      expect(parsedArchive.assets[0].id).toBe(sharedAsset.id);

      // Verify round-trip read
      const restored = await readProjectArchive(archiveText);
      expect(restored.assets).toHaveLength(1);
      expect(restored.project.entries).toHaveLength(3);
    });
  });
});

