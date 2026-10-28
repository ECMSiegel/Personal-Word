import { describe, expect, it } from "vitest";
import { MAX_ASSET_BYTES, createBrowserAssetStore, sha256Hex } from "./assets";
import { createPendingPdf, inspectPdf, verifyPendingPdf } from "./pdf";

const pdfBytes = (extra = "1 0 obj <<>> endobj") =>
  new TextEncoder().encode(`%PDF-1.4\n${extra}\n%%EOF`);

// Same minimal IndexedDB double as src/assets/assets.test.ts.
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

describe("inspectPdf", () => {
  it("reads a PDF header and reports no dimensions", () => {
    const bytes = pdfBytes();
    expect(inspectPdf(bytes)).toEqual({ mime: "application/pdf", byteLength: bytes.length, width: 0, height: 0 });
  });
  it("refuses anything without the header", () => {
    expect(() => inspectPdf(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toThrow("Choose a PDF file.");
    expect(() => inspectPdf(new TextEncoder().encode("%PDX-1.4"))).toThrow("Choose a PDF file.");
  });
  it("treats empty bytes as a size problem", () => {
    expect(() => inspectPdf(new Uint8Array())).toThrow("PDFs must be 25 MB or smaller.");
  });
  it("enforces the 25 MB cap", () => {
    const big = new Uint8Array(MAX_ASSET_BYTES + 1);
    big.set(pdfBytes().subarray(0, 8));
    expect(() => inspectPdf(big)).toThrow("PDFs must be 25 MB or smaller.");
    const edge = new Uint8Array(MAX_ASSET_BYTES);
    edge.set(pdfBytes().subarray(0, 8));
    expect(inspectPdf(edge).byteLength).toBe(MAX_ASSET_BYTES);
  });
});

describe("pending PDFs", () => {
  it("get their SHA-256 id and verify", async () => {
    const bytes = pdfBytes();
    const pdf = await createPendingPdf(bytes);
    expect(pdf.id).toBe(await sha256Hex(bytes));
    await expect(verifyPendingPdf(pdf)).resolves.toBeUndefined();
  });
  it("fail verification on a hash mismatch, bad id or wrong meta", async () => {
    const pdf = await createPendingPdf(pdfBytes());
    await expect(verifyPendingPdf({ ...pdf, bytes: pdfBytes("other") })).rejects.toThrow(/do not match/);
    await expect(verifyPendingPdf({ ...pdf, id: "xyz" })).rejects.toThrow(/Invalid/);
    await expect(
      verifyPendingPdf({ ...pdf, meta: { ...pdf.meta, byteLength: 1 } }),
    ).rejects.toThrow(/does not match/);
    await expect(
      verifyPendingPdf({ ...pdf, meta: { ...pdf.meta, width: 5 as 0 } }),
    ).rejects.toThrow(/does not match/);
  });
});

describe("browser store PDFs", () => {
  it("round-trips by project and id", async () => {
    const store = createBrowserAssetStore(() => fakeIndexedDB() as never);
    const pdf = await createPendingPdf(pdfBytes());
    await store.putPdf("p1", pdf);
    expect(await store.getPdf("p1", pdf.id)).toEqual(pdf);
    expect(await store.getPdf("p2", pdf.id)).toBeNull();
  });
  it("refuses a put whose bytes do not match the id", async () => {
    const store = createBrowserAssetStore(() => fakeIndexedDB() as never);
    const pdf = await createPendingPdf(pdfBytes());
    await expect(store.putPdf("p1", { ...pdf, id: "0".repeat(64) })).rejects.toThrow();
  });
});
