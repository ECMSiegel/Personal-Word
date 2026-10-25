import { describe, it, expect, vi } from "vitest";
import { entry, newProject } from "../model";
import {
  importFragment,
  mergeMissingResearch,
  copyFragmentAssets,
  importFragmentWithAssets,
} from "./operations";
import { createPendingAsset } from "../assets/assets";
import type { PendingAsset } from "../assets/types";

const pngBytes = (w: number, h: number) => {
  const b = [
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
    0, 0, w >> 8, w & 255, 0, 0, h >> 8, h & 255,
    8, 2, 0, 0, 0, 0, 0, 0, 0,
  ];
  return new Uint8Array(b);
};

describe("fragment research integrity", () => {
  it("remaps copied footnotes and sources without overwriting target notes", () => {
    const a = newProject("Target"),
      b = newProject("Source"),
      f = entry("fragment", "Quote");
    a.research = {
      sources: [],
      notes: [],
      footnotes: [{ id: "same", text: "Target note" }],
    };
    b.research = {
      sources: [
        { id: "book", kind: "book", title: "A book", authors: ["A Writer"] },
      ],
      notes: [],
      footnotes: [{ id: "same", text: "Source note", sourceId: "book" }],
    };
    f.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "footnoteReference", attrs: { id: "same" } }],
        },
      ],
    };
    const result = importFragment(a, b, f);
    expect(result.research?.footnotes).toHaveLength(2);
    const copy = result.entries.at(-1)!;
    const id = copy.content.content![0].content![0].attrs!.id;
    expect(id).not.toBe("same");
    expect(result.research?.footnotes.find((n) => n.id === id)?.text).toBe(
      "Source note",
    );
    expect(f.content.content![0].content![0].attrs!.id).toBe("same");
  });
  it("section restore preserves the project automatic-note preference", () => {
    const current = { sources: [], notes: [], footnotes: [], autoShortNotes: true };
    expect(mergeMissingResearch(current, undefined).autoShortNotes).toBe(true);
    expect(mergeMissingResearch(undefined, current).autoShortNotes).toBeUndefined();
  });
  it("section restore keeps newly added research", () => {
    expect(
      mergeMissingResearch(
        { sources: [], notes: [], footnotes: [{ id: "new", text: "New" }] },
        { sources: [], notes: [], footnotes: [{ id: "old", text: "Old" }] },
      ).footnotes.map((n) => n.id),
    ).toEqual(["new", "old"]);
  });
});

describe("fragment image asset copying", () => {
  it("copies referenced fragment image assets into target project before importing", async () => {
    const target = newProject("Target");
    const source = newProject("Source");
    const asset = await createPendingAsset(pngBytes(12, 12));

    const sourceStore = new Map<string, PendingAsset>([[asset.id, asset]]);
    const targetStore = new Map<string, PendingAsset>();

    const mockStorage = {
      readAsset: vi.fn(async (projectId: string, id: string) => {
        if (projectId === source.id && sourceStore.has(id)) {
          return sourceStore.get(id)!;
        }
        throw new Error("Asset not found");
      }),
      stageAssets: vi.fn(async (projectId: string, assets: PendingAsset[]) => {
        if (projectId === target.id) {
          for (const a of assets) targetStore.set(a.id, a);
        }
        return assets.map((a) => a.meta);
      }),
    };

    const f = entry("fragment", "Visual Fragment");
    f.content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Look:" }] },
        { type: "image", attrs: { assetId: asset.id, alt: "Chart" } },
      ],
    };

    const staged = await copyFragmentAssets(target.id, source.id, f, mockStorage);
    expect(staged).toHaveLength(1);
    expect(staged[0].id).toBe(asset.id);
    expect(mockStorage.readAsset).toHaveBeenCalledWith(source.id, asset.id);
    expect(mockStorage.stageAssets).toHaveBeenCalledWith(target.id, [asset]);
    expect(targetStore.has(asset.id)).toBe(true);

    const result = importFragment(target, source, f);
    const copy = result.entries.at(-1)!;
    expect(copy.title).toBe("Visual Fragment");
    expect(copy.content.content?.[1].attrs?.assetId).toBe(asset.id);
  });

  it("fails cleanly and does not stage assets if source asset resolution fails", async () => {
    const target = newProject("Target");
    const source = newProject("Source");
    const asset = await createPendingAsset(pngBytes(10, 10));

    const targetStore = new Map<string, PendingAsset>();
    const mockStorage = {
      readAsset: vi.fn(async () => {
        throw new Error("This image is not stored in the project.");
      }),
      stageAssets: vi.fn(async (_projectId: string, assets: PendingAsset[]) => {
        for (const a of assets) targetStore.set(a.id, a);
      }),
    };

    const f = entry("fragment", "Broken Fragment");
    f.content = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: asset.id, alt: "" } }],
    };

    await expect(
      copyFragmentAssets(target.id, source.id, f, mockStorage),
    ).rejects.toThrow("This image is not stored in the project.");

    expect(mockStorage.stageAssets).not.toHaveBeenCalled();
    expect(targetStore.size).toBe(0);
  });

  it("does not call storage when fragment contains no images", async () => {
    const target = newProject("Target");
    const source = newProject("Source");
    const mockStorage = {
      readAsset: vi.fn(),
      stageAssets: vi.fn(),
    };

    const f = entry("fragment", "Text Only");
    f.content = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Simple text" }] }],
    };

    const staged = await copyFragmentAssets(target.id, source.id, f, mockStorage);
    expect(staged).toEqual([]);
    expect(mockStorage.readAsset).not.toHaveBeenCalled();
    expect(mockStorage.stageAssets).not.toHaveBeenCalled();
  });

  it("handles fragments with both image assets and remapped footnotes", async () => {
    const target = newProject("Target");
    const source = newProject("Source");
    const asset = await createPendingAsset(pngBytes(8, 8));

    source.research = {
      sources: [{ id: "src1", kind: "journal", title: "Article", authors: [] }],
      notes: [],
      footnotes: [{ id: "fn1", text: "Note text", sourceId: "src1" }],
    };

    const mockStorage = {
      readAsset: vi.fn(async () => asset),
      stageAssets: vi.fn(async () => [asset.meta]),
    };

    const f = entry("fragment", "Combined");
    f.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Note ref: " },
            { type: "footnoteReference", attrs: { id: "fn1" } },
          ],
        },
        { type: "image", attrs: { assetId: asset.id, alt: "Figure" } },
      ],
    };

    const result = await importFragmentWithAssets(target, source, f, mockStorage);
    expect(mockStorage.readAsset).toHaveBeenCalledWith(source.id, asset.id);
    expect(mockStorage.stageAssets).toHaveBeenCalledWith(target.id, [asset]);

    const copy = result.entries.at(-1)!;
    // Image asset ID remains identical
    expect(copy.content.content?.[1].attrs?.assetId).toBe(asset.id);
    // Footnote ID is remapped
    const newFnId = copy.content.content?.[0].content?.[1].attrs?.id;
    expect(newFnId).not.toBe("fn1");
    expect(result.research?.footnotes.find((n) => n.id === newFnId)?.text).toBe("Note text");
  });
});

