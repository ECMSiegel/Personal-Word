import { describe, expect, it, vi } from "vitest";
import { createPendingAsset, toBase64 } from "./assets/assets";
import type { PendingAsset } from "./assets/types";
import { emptyDoc, type Project } from "./model";

// The editor schema may not know the "image" node yet (the integrator adds it). Until then, run the
// real validateProject on a copy whose image nodes are paragraphs; every other check stays real.
vi.mock("./model", async (original) => {
  const actual = await original<typeof import("./model")>();
  const flat = (n: unknown): unknown =>
    Array.isArray(n) ? n.map(flat)
    : n && typeof n === "object"
      ? (n as { type?: string }).type === "image" ? { type: "paragraph" }
      : Object.fromEntries(Object.entries(n).map(([k, v]) => [k, flat(v)]))
      : n;
  return { ...actual, validateProject: (v: unknown) => actual.validateProject(flat(v)) };
});
import { createProjectArchive, readProjectArchive } from "./projectArchive";

const png = (w: number, h: number, tail = 0) => {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, w >> 8, w & 255, 0, 0, h >> 8, h & 255, 8, 2, 0, 0, 0, 0, 0, 0, 0];
  const out = new Uint8Array(b.length + tail);
  out.set(b);
  return out;
};

function project(assetIds: string[] = [], extra: Record<string, unknown> = {}): Project {
  const now = "2026-01-01T00:00:00.000Z";
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Book",
    createdAt: now,
    updatedAt: now,
    revision: 3,
    order: ["22222222-2222-4222-8222-222222222222"],
    entries: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        kind: "section",
        title: "One",
        content: {
          ...emptyDoc(),
          content: [...assetIds.map((assetId) => ({ type: "image", attrs: { assetId, alt: "", title: null, width: null, height: null } })), { type: "paragraph" }],
        },
        text: "",
        updatedAt: now,
        origin: null,
        futureEntryField: { keep: [1, 2] },
      },
    ],
    futureProjectField: "kept",
    ...extra,
  } as unknown as Project;
}

const resolverFor = (...assets: PendingAsset[]) => async (id: string) => {
  const a = assets.find((x) => x.id === id);
  if (!a) throw new Error("not stored");
  return a;
};

describe("readProjectArchive", () => {
  it("accepts a legacy plain project unchanged, extra fields included", async () => {
    const p = project();
    const r = await readProjectArchive(JSON.stringify(p));
    expect(r.project).toEqual(p);
    expect(r.assets).toEqual([]);
  });

  it("round trips a v2 archive with an image", async () => {
    const a = await createPendingAsset(png(8, 6, 1000));
    const p = project([a.id]);
    const text = await createProjectArchive(p, resolverFor(a));
    expect(JSON.parse(text)).toMatchObject({ format: "personal-word", version: 2 });
    const r = await readProjectArchive(text);
    expect(r.project).toEqual(p);
    expect(r.assets).toEqual([a]);
    expect(r.ignoredAssetIds).toEqual([]);
  });

  it("refuses to create a partial archive", async () => {
    const a = await createPendingAsset(png(8, 6));
    await expect(createProjectArchive(project([a.id]), resolverFor())).rejects.toThrow(/could not be loaded/);
  });

  it("rejects a missing referenced asset", async () => {
    const a = await createPendingAsset(png(8, 6));
    const text = JSON.stringify({ format: "personal-word", version: 2, project: project([a.id]), assets: [] });
    await expect(readProjectArchive(text)).rejects.toThrow(/missing image/);
  });

  it("rejects tampered bytes, wrong meta, and duplicates", async () => {
    const a = await createPendingAsset(png(8, 6, 40));
    const bad = a.bytes.slice();
    bad[40] ^= 1;
    const mk = (row: object, rows: object[] = [row]) =>
      JSON.stringify({ format: "personal-word", version: 2, project: project([a.id]), assets: rows });
    const good = { id: a.id, meta: a.meta, data: toBase64(a.bytes) };
    await expect(readProjectArchive(mk({ ...good, data: toBase64(bad) }))).rejects.toThrow(/identifier/);
    await expect(readProjectArchive(mk({ ...good, meta: { ...a.meta, height: 9 } }))).rejects.toThrow(/does not match/);
    await expect(readProjectArchive(mk(good, [good, good]))).rejects.toThrow(/twice/);
    await expect(readProjectArchive(mk({ ...good, data: "!!!!" }))).rejects.toThrow(/base64/);
  });

  it("ignores and reports unreferenced extras", async () => {
    const a = await createPendingAsset(png(8, 6));
    const extra = await createPendingAsset(png(9, 9));
    const text = JSON.stringify({
      format: "personal-word",
      version: 2,
      project: project([a.id]),
      assets: [extra, a].map((x) => ({ id: x.id, meta: x.meta, data: toBase64(x.bytes) })),
    });
    const r = await readProjectArchive(text);
    expect(r.assets.map((x) => x.id)).toEqual([a.id]);
    expect(r.ignoredAssetIds).toEqual([extra.id]);
  });

  it("rejects unknown versions and invalid projects", async () => {
    await expect(readProjectArchive(JSON.stringify({ format: "personal-word", version: 3, project: project(), assets: [] }))).rejects.toThrow(/version/);
    await expect(readProjectArchive(JSON.stringify({ format: "personal-word", version: 2, project: { id: "x" }, assets: [] }))).rejects.toThrow(/valid Personal Word/);
  });

  it("is safe with __proto__ ids and fields", async () => {
    const text = JSON.stringify({ format: "personal-word", version: 2, project: project(["__proto__"]), assets: [] });
    await expect(readProjectArchive(text)).rejects.toThrow(/missing image/);
    const row = { id: "__proto__", meta: {}, data: "" };
    await expect(
      readProjectArchive(JSON.stringify({ format: "personal-word", version: 2, project: project(), assets: [row] })),
    ).rejects.toThrow(/invalid image entry/);
    const withProto = '{"format":"personal-word","version":2,"assets":[],"__proto__":{"polluted":1},"project":' + JSON.stringify(project()) + "}";
    await readProjectArchive(withProto);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
