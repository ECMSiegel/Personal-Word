import { describe, expect, it } from "vitest";
import {
  browserAssetStore as _unused,
  collectAssetIds,
  createBrowserAssetStore,
  createPendingAsset,
  fromBase64,
  inspectImage,
  sha256Hex,
  toBase64,
  verifyPendingAsset,
} from "./assets";

void _unused;

export function png(width: number, height: number, extra = 0): Uint8Array {
  const b = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
  const be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  b.push(...be(width), ...be(height), 8, 2, 0, 0, 0, 0, 0, 0, 0);
  const out = new Uint8Array(b.length + extra);
  out.set(b);
  return out;
}
export function jpeg(width: number, height: number): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, // APP0 with 2 payload bytes
    0xff, 0xc4, 0, 3, 0, // DHT must be skipped
    0xff, 0xc0, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 0x11, 0,
    0xff, 0xd9,
  ]);
}

describe("inspectImage", () => {
  it("reads PNG and JPEG sizes", () => {
    expect(inspectImage(png(2, 3))).toEqual({ mime: "image/png", byteLength: 33, width: 2, height: 3 });
    expect(inspectImage(jpeg(300, 5))).toMatchObject({ mime: "image/jpeg", width: 300, height: 5 });
  });
  it("rejects GIF, empty, zero or huge dimensions, truncated, and oversize", () => {
    expect(() => inspectImage(new TextEncoder().encode("GIF89a......"))).toThrow(/PNG and JPEG/);
    expect(() => inspectImage(new Uint8Array())).toThrow(/empty/);
    expect(() => inspectImage(png(0, 5))).toThrow(/dimensions/);
    expect(() => inspectImage(png(20001, 5))).toThrow(/dimensions/);
    expect(() => inspectImage(png(20000, 20000))).not.toThrow();
    expect(() => inspectImage(png(1, 1).subarray(0, 20))).toThrow(/incomplete/);
    expect(() => inspectImage(jpeg(5, 5).subarray(0, 12))).toThrow(/JPEG/);
    expect(() => inspectImage(png(1, 1, 25 * 1024 * 1024))).toThrow(/25 MB/);
  });
});

describe("pending assets", () => {
  it("creates and verifies", async () => {
    const a = await createPendingAsset(png(4, 4));
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(a.id).toBe(await sha256Hex(a.bytes));
    await expect(verifyPendingAsset(a)).resolves.toBeUndefined();
  });
  it("rejects hash and meta mismatches", async () => {
    const a = await createPendingAsset(png(4, 4));
    await expect(verifyPendingAsset({ ...a, id: "0".repeat(64) })).rejects.toThrow(/identifier/);
    await expect(verifyPendingAsset({ ...a, id: "xyz" })).rejects.toThrow(/Invalid image identifier/);
    await expect(verifyPendingAsset({ ...a, meta: { ...a.meta, width: 5 } })).rejects.toThrow(/does not match/);
    await expect(verifyPendingAsset({ ...a, meta: { ...a.meta, mime: "image/jpeg" } })).rejects.toThrow(/does not match/);
    const tampered = a.bytes.slice();
    tampered[30] ^= 1;
    await expect(verifyPendingAsset({ ...a, bytes: tampered })).rejects.toThrow(/identifier/);
  });
});

describe("base64", () => {
  it("round trips ~3 MB without stack overflow", () => {
    const big = new Uint8Array(3 * 1024 * 1024 + 1);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31 + 7) & 255;
    const text = toBase64(big);
    expect(text === Buffer.from(big).toString("base64")).toBe(true);
    expect(Buffer.from(fromBase64(text)).equals(big)).toBe(true);
  });
  it("handles padding lengths and rejects invalid input", () => {
    for (const n of [0, 1, 2, 3, 4]) {
      const b = Uint8Array.from({ length: n }, (_, i) => i + 250);
      expect(fromBase64(toBase64(b))).toEqual(b);
    }
    for (const bad of ["abc", "ab=d", "ab\n=", "a b=", "@@@@", "ab==ab==", "====", "é==="])
      expect(() => fromBase64(bad)).toThrow(/base64/);
  });
});

describe("collectAssetIds", () => {
  const img = (id: string) => ({ type: "image", attrs: { assetId: id } });
  it("walks nested content and all entries", () => {
    const doc = { type: "doc", content: [img("a"), { type: "blockquote", content: [img("b"), img("a")] }, { type: "image", attrs: {} }] };
    expect([...collectAssetIds(doc)].sort()).toEqual(["a", "b"]);
    const project = { entries: [{ content: doc }, { content: { type: "doc", content: [img("c")] } }] };
    expect([...collectAssetIds(project as never)].sort()).toEqual(["a", "b", "c"]);
  });
  it("is safe with prototype keys", () => {
    const doc = JSON.parse('{"type":"doc","__proto__":{"polluted":1},"content":[{"type":"image","attrs":{"assetId":"__proto__"}}]}');
    expect([...collectAssetIds(doc)]).toEqual(["__proto__"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

function fakeIndexedDB() {
  const data = new Map<string, unknown>();
  const req = <T,>(run: () => T) => {
    const r: Record<string, unknown> = {};
    queueMicrotask(() => {
      r.result = run();
      (r.onsuccess as (() => void) | undefined)?.();
    });
    return r;
  };
  const store = {
    put: (v: unknown, k: string) => req(() => void data.set(k, structuredClone(v))),
    get: (k: string) => req(() => structuredClone(data.get(k))),
  };
  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => store,
    transaction: () => {
      const tx: Record<string, unknown> = { objectStore: () => ({
        put: (v: unknown, k: string) => { const r = store.put(v, k); queueMicrotask(() => queueMicrotask(() => (tx.oncomplete as () => void)?.())); return r; },
        get: store.get,
      }) };
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

describe("browserAssetStore", () => {
  it("keys by project and id", async () => {
    const store = createBrowserAssetStore(() => fakeIndexedDB() as never);
    const a = await createPendingAsset(png(4, 4));
    await store.put("p1", a);
    expect(await store.get("p1", a.id)).toEqual(a);
    expect(await store.get("p2", a.id)).toBeNull();
    expect(await store.get("p1", "f".repeat(64))).toBeNull();
  });
  it("refuses unverifiable puts and reports unavailable storage", async () => {
    const store = createBrowserAssetStore(() => fakeIndexedDB() as never);
    const a = await createPendingAsset(png(4, 4));
    await expect(store.put("p1", { ...a, id: "0".repeat(64) })).rejects.toThrow();
    const none = createBrowserAssetStore(() => undefined);
    await expect(none.get("p", a.id)).rejects.toThrow(/unavailable/);
  });
});
