import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { storage, setDesktopForTesting } from "./storage";
import { browserAssetStore, createPendingAsset, fromBase64, sha256Hex, toBase64 } from "./assets/assets";
import { newProject, textOf, type Project } from "./model";
import { headerOf } from "./save-queue";
import { createProjectArchive, readProjectArchive } from "./projectArchive";
import betaFixture from "../tests/fixtures/beta-synthetic-project.json";

function png(width: number, height: number): Uint8Array {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  b.push(...be(width), ...be(height), 8, 2, 0, 0, 0, 0, 0, 0, 0);
  const out = new Uint8Array(b.length);
  out.set(b);
  return out;
}

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => false),
  invoke: vi.fn(),
}));

const idbData = new Map<string, unknown>();
function fakeIndexedDB() {
  const req = <T,>(run: () => T) => {
    const r: Record<string, unknown> = {};
    queueMicrotask(() => {
      r.result = run();
      (r.onsuccess as (() => void) | undefined)?.();
    });
    return r;
  };
  const store = {
    put: (v: unknown, k: string) => req(() => void idbData.set(k, structuredClone(v))),
    get: (k: string) => req(() => structuredClone(idbData.get(k))),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => {
      const tx: Record<string, unknown> = {
        objectStore: () => ({
          put: (v: unknown, k: string) => {
            const r = store.put(v, k);
            queueMicrotask(() => queueMicrotask(() => (tx.oncomplete as () => void)?.()));
            return r;
          },
          get: store.get,
        }),
      };
      return tx;
    },
  };
  return {
    open: () => {
      const r: Record<string, unknown> = { result: db };
      queueMicrotask(() => (r.onsuccess as () => void)());
      return r;
    },
  };
}

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

describe("storage adapter - desktop native", () => {
  beforeEach(() => {
    setDesktopForTesting(true);
    vi.clearAllMocks();
  });

  it("stages assets via native stage_assets IPC", async () => {
    const a1 = await createPendingAsset(png(10, 10));
    const a2 = await createPendingAsset(png(20, 20));
    vi.mocked(invoke).mockResolvedValueOnce([a1.meta, a2.meta]);

    const metas = await storage.stageAssets("proj-1", [a1, a2]);
    expect(invoke).toHaveBeenCalledWith("stage_assets", {
      projectId: "proj-1",
      assets: [
        { id: a1.id, meta: a1.meta, data: toBase64(a1.bytes) },
        { id: a2.id, meta: a2.meta, data: toBase64(a2.bytes) },
      ],
    });
    expect(metas).toEqual([a1.meta, a2.meta]);
  });

  it("propagates native stage_assets failure", async () => {
    const a = await createPendingAsset(png(10, 10));
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Image bytes do not match identifier"));
    await expect(storage.stageAssets("proj-1", [a])).rejects.toThrow("Image bytes do not match identifier");
  });

  it("reads an asset via native read_asset IPC and verifies bytes", async () => {
    const a = await createPendingAsset(png(10, 10));
    vi.mocked(invoke).mockResolvedValueOnce(a.bytes.buffer);

    const loaded = await storage.readAsset("proj-1", a.id);
    expect(invoke).toHaveBeenCalledWith("read_asset", {
      projectId: "proj-1",
      assetId: a.id,
    });
    expect(loaded.id).toBe(a.id);
    expect(loaded.bytes).toEqual(a.bytes);
    expect(loaded.meta).toEqual(a.meta);
  });

  it("rejects readAsset if native returns corrupted bytes", async () => {
    const a = await createPendingAsset(png(10, 10));
    const corrupted = a.bytes.slice();
    corrupted[20] ^= 1;
    vi.mocked(invoke).mockResolvedValueOnce(corrupted.buffer);

    await expect(storage.readAsset("proj-1", a.id)).rejects.toThrow();
  });

  it("propagates readAsset error when asset is not stored", async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error("This image is not stored in the project."));
    await expect(storage.readAsset("proj-1", "0".repeat(64))).rejects.toThrow(
      "This image is not stored in the project."
    );
  });

  it("creates project with assets via native create_project_with_assets IPC", async () => {
    const p = newProject("Native Book");
    const a = await createPendingAsset(png(10, 10));
    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await storage.createProjectWithAssets(p, [a]);
    expect(invoke).toHaveBeenCalledWith("create_project_with_assets", {
      change: {
        header: {
          id: p.id,
          title: p.title,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          revision: p.revision,
          order: p.order,
          research: p.research,
          entryIds: p.entries.map((e) => e.id),
        },
        entries: p.entries,
        baseRevision: null,
      },
      assets: [{ id: a.id, meta: a.meta, data: toBase64(a.bytes) }],
    });
  });

  it("validates project before native create_project_with_assets IPC", async () => {
    const p = newProject("Broken");
    p.id = "not-a-uuid";
    const a = await createPendingAsset(png(10, 10));

    await expect(storage.createProjectWithAssets(p, [a])).rejects.toThrow(
      "This is not a valid Personal Word project."
    );
    expect(invoke).not.toHaveBeenCalled();
  });

  it("propagates duplicate project error from native create_project_with_assets", async () => {
    const p = newProject("Duplicate");
    const a = await createPendingAsset(png(10, 10));
    vi.mocked(invoke).mockRejectedValueOnce(
      new Error("A project with this identity already exists; nothing was replaced.")
    );

    await expect(storage.createProjectWithAssets(p, [a])).rejects.toThrow(
      "A project with this identity already exists; nothing was replaced."
    );
  });
});

describe("storage adapter - browser preview", () => {
  beforeEach(() => {
    setDesktopForTesting(false);
    (globalThis as any).localStorage = createMemoryStorage();
    (globalThis as any).indexedDB = fakeIndexedDB();
    idbData.clear();
    vi.clearAllMocks();
  });

  it("stages assets into browserAssetStore and returns metadata", async () => {
    const a = await createPendingAsset(png(10, 10));
    const metas = await storage.stageAssets("browser-p1", [a]);
    expect(metas).toEqual([a.meta]);

    const stored = await browserAssetStore.get("browser-p1", a.id);
    expect(stored).toEqual(a);
  });

  it("reads stored asset from browserAssetStore", async () => {
    const a = await createPendingAsset(png(10, 10));
    await storage.stageAssets("browser-p1", [a]);

    const read = await storage.readAsset("browser-p1", a.id);
    expect(read).toEqual(a);
  });

  it("throws for invalid asset ID in readAsset", async () => {
    await expect(storage.readAsset("browser-p1", "invalid-id")).rejects.toThrow(
      "Invalid image identifier"
    );
  });

  it("throws not found when reading absent browser asset", async () => {
    await expect(storage.readAsset("browser-p1", "0".repeat(64))).rejects.toThrow(
      "This image is not stored in the project."
    );
  });

  it("enforces project scoping for browser asset storage", async () => {
    const a = await createPendingAsset(png(10, 10));
    await storage.stageAssets("project-alpha", [a]);

    const readAlpha = await storage.readAsset("project-alpha", a.id);
    expect(readAlpha).toEqual(a);

    await expect(storage.readAsset("project-beta", a.id)).rejects.toThrow(
      "This image is not stored in the project."
    );
  });

  it("keeps the acknowledged project and history when a save references another project's image", async () => {
    const p = newProject("Saved writing");
    await storage.createProjectWithAssets(p, []);
    const image = await createPendingAsset(png(12, 12));
    await storage.stageAssets("another-project", [image]);
    const edited = structuredClone(p);
    edited.revision += 1;
    edited.entries[0].content = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: image.id, alt: "A chart" } }],
    };
    edited.entries[0].text = textOf(edited.entries[0].content);
    const change = { header: headerOf(edited), entries: edited.entries, baseRevision: p.revision };

    await expect(storage.save(change)).rejects.toThrow("image");
    expect(await storage.load(p.id)).toEqual(p);
    expect(await storage.versions(p.id, true)).toEqual([]);

    await storage.stageAssets(p.id, [image]);
    await storage.save(change);
    expect(await storage.load(p.id)).toEqual(edited);
    expect(await storage.version(p.id, String(p.revision), true)).toEqual(p);
  });

  it("does not create a browser project when an initial save references an unstaged image", async () => {
    const p = newProject("Missing initial image");
    p.entries[0].content = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: "a".repeat(64), alt: "Missing" } }],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    await expect(storage.save({ header: headerOf(p), entries: p.entries, baseRevision: null })).rejects.toThrow("image");
    await expect(storage.load(p.id)).rejects.toThrow();
  });

  it("creates project with assets atomically in browser storage", async () => {
    const p = newProject("Browser Book");
    const a = await createPendingAsset(png(10, 10));

    await storage.createProjectWithAssets(p, [a]);

    const loaded = await storage.load(p.id);
    expect(loaded.title).toBe("Browser Book");

    const asset = await storage.readAsset(p.id, a.id);
    expect(asset).toEqual(a);
  });

  it("rejects createProjectWithAssets if project identity already exists", async () => {
    const p = newProject("Duplicate");
    const a = await createPendingAsset(png(10, 10));

    await storage.createProjectWithAssets(p, [a]);
    await expect(storage.createProjectWithAssets(p, [a])).rejects.toThrow(
      "A project with this identity already exists; nothing was replaced."
    );
  });

  it("rejects createProjectWithAssets if project content references missing image", async () => {
    const p = newProject("Missing Reference");
    const missingId = "e".repeat(64);
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: missingId, alt: "Missing" },
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);

    await expect(storage.createProjectWithAssets(p, [])).rejects.toThrow(
      "An image in this edit is missing from the project's storage; nothing was saved. Your recovery journal has been kept."
    );
    await expect(storage.load(p.id)).rejects.toThrow();
  });

  it("does not save project if asset staging fails during createProjectWithAssets", async () => {
    const p = newProject("Failing Project");
    const badAsset = {
      id: "0".repeat(64),
      meta: { mime: "image/png" as const, byteLength: 10, width: 10, height: 10 },
      bytes: new Uint8Array(10),
    };

    await expect(storage.createProjectWithAssets(p, [badAsset])).rejects.toThrow();
    await expect(storage.load(p.id)).rejects.toThrow();
  });

  // D2 durability matrix, browser adapter route: the synthetic beta project (tests/fixtures/beta-synthetic-project.json)
  // through creation with images, one-entry saves, history, snapshots, a restore and an archive import.
  describe("synthetic beta project", () => {
    type Edit = { entryId?: string; updatedAt: string; entry?: Record<string, unknown> };
    const fx = betaFixture as unknown as {
      ids: { sec1: string; sec2: string; frag: string };
      assets: { name: string; id: string; meta: never; data: string }[];
      initial: Project;
      edits: Record<"incremental" | "second" | "lateImage" | "restore", Edit>;
    };
    const next = (project: Project, edit: Edit): Project => {
      const copy = structuredClone(project);
      copy.revision += 1;
      copy.updatedAt = edit.updatedAt;
      const index = copy.entries.findIndex((e) => e.id === edit.entryId);
      copy.entries[index] = { ...copy.entries[index], ...structuredClone(edit.entry) } as Project["entries"][number];
      return copy;
    };
    const pendingAsset = (name: string) => {
      const a = fx.assets.find((item) => item.name === name)!;
      return { id: a.id, meta: a.meta, bytes: fromBase64(a.data) };
    };
    const save = (project: Project, changed: string[], base: number) =>
      storage.save({ header: headerOf(project), entries: project.entries.filter((e) => changed.includes(e.id)), baseRevision: base });

    it("keeps every field and image byte through saves, history, snapshots, restore and a later image", async () => {
      const s1 = fx.initial;
      await storage.createProjectWithAssets(s1, [pendingAsset("png-section-drawing"), pendingAsset("jpeg-sherd")]);
      expect(await storage.load(s1.id)).toEqual(s1);

      const s2 = next(s1, fx.edits.incremental);
      await save(s2, [fx.ids.sec2], 1);
      expect(await storage.load(s1.id)).toEqual(s2);
      expect(await storage.version(s1.id, "1", true)).toEqual(s1);

      const named = await storage.snapshot(s1.id, "Beta snapshot A");
      const s3 = next(s2, fx.edits.second);
      await save(s3, [fx.ids.sec2], 2);
      const safety = await storage.snapshot(s1.id, "Before restoring Beta snapshot A");
      expect(await storage.version(s1.id, safety, false)).toEqual(s3);
      expect(await storage.version(s1.id, named, false)).toEqual(s2);

      const restored = { ...structuredClone(s2), revision: 4, updatedAt: fx.edits.restore.updatedAt };
      await save(restored, [fx.ids.sec2], 3);
      expect(await storage.load(s1.id)).toEqual(restored);
      expect((await storage.versions(s1.id, false)).map((v) => v.name)).toEqual(["Before restoring Beta snapshot A", "Beta snapshot A"]);

      // A later image must be staged before the edit that references it; without it the save is refused and nothing changes.
      const withLate = next(restored, fx.edits.lateImage);
      await expect(save(withLate, [fx.ids.sec2], 4)).rejects.toThrow("image");
      expect(await storage.load(s1.id)).toEqual(restored);
      await storage.stageAssets(s1.id, [pendingAsset("png-late")]);
      await save(withLate, [fx.ids.sec2], 4);
      expect(await storage.load(s1.id)).toEqual(withLate);
      for (const a of fx.assets) {
        const read = await storage.readAsset(s1.id, a.id);
        expect(await sha256Hex(read.bytes)).toBe(a.id);
        expect(toBase64(read.bytes)).toBe(a.data);
      }

      // Control: the comparison sees a dropped metadata field.
      const dropped = structuredClone(withLate) as Project & { goals?: unknown };
      delete dropped.goals;
      expect(await storage.load(s1.id)).not.toEqual(dropped);
    });

    it("imports a v2 archive under a new identity with identical content and image bytes", async () => {
      const s1 = fx.initial;
      await storage.createProjectWithAssets(s1, [pendingAsset("png-section-drawing"), pendingAsset("jpeg-sherd")]);
      const archive = await createProjectArchive(await storage.load(s1.id), (id) => storage.readAsset(s1.id, id));
      const { project, assets } = await readProjectArchive(archive);
      const imported: Project = { ...project, id: "b1b2c3d4-0000-4000-8000-0000000000ee", revision: 1, title: project.title + " (recovered)", updatedAt: "2026-10-25T00:00:00.000Z" };
      await storage.createProjectWithAssets(imported, assets);
      const loaded = await storage.load(imported.id);
      expect(loaded).toEqual(imported);
      expect({ ...loaded, id: s1.id, revision: s1.revision, title: s1.title, updatedAt: s1.updatedAt }).toEqual(s1);
      for (const a of assets) expect(await sha256Hex((await storage.readAsset(imported.id, a.id)).bytes)).toBe(a.id);
      // The original keeps its own identity and history.
      expect(await storage.load(s1.id)).toEqual(s1);
    });
  });
});
