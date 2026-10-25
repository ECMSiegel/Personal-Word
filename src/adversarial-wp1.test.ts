import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { storage, setDesktopForTesting } from "./storage";
import {
  createPendingAsset,
  toBase64,
  isAssetId,
  collectAssetIds,
} from "./assets/assets";
import { newProject, textOf, words, validateProject } from "./model";

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
      try {
        r.result = run();
        (r.onsuccess as (() => void) | undefined)?.();
      } catch (err) {
        r.error = err;
        (r.onerror as (() => void) | undefined)?.();
      }
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

const validAssetId = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("Adversarial Suite 1: Deeply Nested Tables & Invalid Node Structures", () => {
  it("rejects table directly inside a tableCell", () => {
    const p = newProject("Direct Nested Table");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1 },
                  content: [
                    {
                      type: "table",
                      content: [
                        {
                          type: "tableRow",
                          content: [
                            {
                              type: "tableCell",
                              attrs: { colspan: 1, rowspan: 1 },
                              content: [{ type: "paragraph", content: [{ type: "text", text: "Inside" }] }],
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
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow(RangeError);
  });

  it("rejects table inside a tableHeader", () => {
    const p = newProject("Header Nested Table");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  attrs: { colspan: 1, rowspan: 1 },
                  content: [
                    {
                      type: "table",
                      content: [
                        {
                          type: "tableRow",
                          content: [
                            {
                              type: "tableCell",
                              attrs: { colspan: 1, rowspan: 1 },
                              content: [{ type: "paragraph", content: [{ type: "text", text: "Header Table" }] }],
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
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow(RangeError);
  });

  it("rejects nested table hidden inside blockquote inside tableCell", () => {
    const p = newProject("Blockquote Nested Table");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 1, rowspan: 1 },
                  content: [
                    {
                      type: "blockquote",
                      content: [
                        {
                          type: "table",
                          content: [
                            {
                              type: "tableRow",
                              content: [
                                {
                                  type: "tableCell",
                                  attrs: { colspan: 1, rowspan: 1 },
                                  content: [{ type: "paragraph", content: [{ type: "text", text: "Hidden" }] }],
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
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow(RangeError);
  });

  it("rejects table with 0 rows", () => {
    const p = newProject("Empty Table");
    p.entries[0].content = {
      type: "doc",
      content: [{ type: "table", content: [] }],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow();
  });

  it("rejects tableRow with 0 cells", () => {
    const p = newProject("Empty Row");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [{ type: "tableRow", content: [] }],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow();
  });

  it("rejects tableCell with 0 content blocks", () => {
    const p = newProject("Empty Cell Content");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [] }],
            },
          ],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow();
  });

  it("rejects tableCell containing inline text directly without a block wrapper", () => {
    const p = newProject("Raw Text Cell");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [{ type: "text", text: "naked text" }] }],
            },
          ],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow();
  });

  it("rejects paragraph containing a block table", () => {
    const p = newProject("Table inside paragraph");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "table",
              content: [
                {
                  type: "tableRow",
                  content: [
                    {
                      type: "tableCell",
                      content: [{ type: "paragraph", content: [{ type: "text", text: "Bad" }] }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow();
  });

  it("handles deep valid nesting without call stack overflow", () => {
    const p = newProject("Deep Nesting");
    let current: any = { type: "paragraph", content: [{ type: "text", text: "Bottom" }] };
    for (let i = 0; i < 80; i++) {
      current = { type: "blockquote", content: [current] };
    }
    p.entries[0].content = { type: "doc", content: [current] };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).not.toThrow();
    expect(p.entries[0].text).toBe("Bottom");
  });
});

describe("Adversarial Suite 2: Malformed Asset IDs", () => {
  const adversarialIds = [
    ["uppercase hex 64 chars", "A".repeat(64)],
    ["mixed-case hex 64 chars", "0123456789ABCDEF".repeat(4)],
    ["63 chars hex", "a".repeat(63)],
    ["65 chars hex", "a".repeat(65)],
    ["empty string", ""],
    ["path traversal relative", "../".repeat(16)],
    ["path traversal /etc/passwd", "/etc/passwd".padEnd(64, "0")],
    ["null byte in 64 chars", "0".repeat(63) + "\0"],
    ["unicode in 64 chars", "0".repeat(63) + "é"],
    ["newline in 64 chars", "0".repeat(63) + "\n"],
    ["spaces in 64 chars", " ".repeat(64)],
    ["non-hex characters", "g".repeat(64)],
    ["special characters", "0".repeat(60) + "!@#$"],
    ["sql injection string", "0".repeat(50) + "'; DROP TABLE;"],
  ];

  it.each(adversarialIds)("validateProject rejects image assetId (%s)", (_desc, badId) => {
    const p = newProject("Adversarial ID");
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: badId, alt: "Adversarial" },
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);
    expect(() => validateProject(p)).toThrow(RangeError);
  });

  it.each(adversarialIds)("isAssetId rejects malformed ID (%s)", (_desc, badId) => {
    expect(isAssetId(badId)).toBe(false);
  });

  it.each(adversarialIds)("storage.readAsset rejects malformed ID in browser mode (%s)", async (_desc, badId) => {
    setDesktopForTesting(false);
    (globalThis as any).localStorage = createMemoryStorage();
    (globalThis as any).indexedDB = fakeIndexedDB();
    await expect(storage.readAsset("test-proj", badId)).rejects.toThrow("Invalid image identifier");
  });
});

describe("Adversarial Suite 3: Massive or Empty Alt Texts in textOf", () => {
  it("extracts empty alt text without adding phantom words", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Top" }] },
        { type: "image", attrs: { assetId: validAssetId, alt: "" } },
        { type: "paragraph", content: [{ type: "text", text: "Bottom" }] },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("Top\n\nBottom");
    expect(words(t)).toBe(2);
  });

  it("extracts missing alt text (undefined) cleanly", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Top" }] },
        { type: "image", attrs: { assetId: validAssetId } },
        { type: "paragraph", content: [{ type: "text", text: "Bottom" }] },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("Top\n\nBottom");
    expect(words(t)).toBe(2);
  });

  it("extracts whitespace-only alt text without polluting word count", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Top" }] },
        { type: "image", attrs: { assetId: validAssetId, alt: "    \t\n   " } },
        { type: "paragraph", content: [{ type: "text", text: "Bottom" }] },
      ],
    };
    const t = textOf(doc);
    expect(words(t)).toBe(2);
  });

  it("handles massive alt text (100,000 characters) accurately", () => {
    const wordList = Array.from({ length: 10000 }, (_, i) => `word${i}`);
    const massiveAlt = wordList.join(" "); // 10,000 words, ~70,000 chars
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Start" }] },
        { type: "image", attrs: { assetId: validAssetId, alt: massiveAlt } },
        { type: "paragraph", content: [{ type: "text", text: "End" }] },
      ],
    };
    const t = textOf(doc);
    expect(t.startsWith("Start\nword0")).toBe(true);
    expect(t.endsWith("word9999\nEnd")).toBe(true);
    expect(words(t)).toBe(10002);
  });

  it("preserves multiline alt text with internal newlines", () => {
    const multilineAlt = "Line 1\nLine 2\nLine 3";
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Header" }] },
        { type: "image", attrs: { assetId: validAssetId, alt: multilineAlt } },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("Header\nLine 1\nLine 2\nLine 3");
    expect(words(t)).toBe(7);
  });

  it("handles alt text with HTML tags and unicode symbols safely", () => {
    const specialAlt = "<figure> & 'quotes' \"test\" -- em-dash 🌟";
    const doc = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: validAssetId, alt: specialAlt } }],
    };
    const t = textOf(doc);
    expect(t).toBe(specialAlt);
    expect(words(t)).toBe(7);
  });
});

describe("Adversarial Suite 4: Multidimensional Tables in textOf", () => {
  it("handles 1x1 table", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Solo" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(textOf(doc)).toBe("Solo");
    expect(words(textOf(doc))).toBe(1);
  });

  it("handles table with multiple rows, headers, and empty cells", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H1" }] }] },
                { type: "tableHeader", content: [{ type: "paragraph" }] }, // empty header
                { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "H3" }] }] },
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph" }] }, // empty
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "R1C2" }] }] },
                { type: "tableCell", content: [{ type: "paragraph" }] }, // empty
              ],
            },
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "R2C1" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "R2C2" }] }] },
                { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "R2C3" }] }] },
              ],
            },
          ],
        },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("H1  H3\n R1C2 \nR2C1 R2C2 R2C3");
    expect(words(t)).toBe(6);
  });

  it("handles table cells containing multiple paragraphs separated by newline", () => {
    const doc = {
      type: "doc",
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
                    { type: "paragraph", content: [{ type: "text", text: "P1A" }] },
                    { type: "paragraph", content: [{ type: "text", text: "P1B" }] },
                  ],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "P2" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("P1A\nP1B P2");
    expect(words(t)).toBe(3);
  });

  it("handles table cells containing images with alt text", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "image", attrs: { assetId: validAssetId, alt: "Graph A" } }],
                },
                {
                  type: "tableCell",
                  content: [{ type: "paragraph", content: [{ type: "text", text: "Explanation" }] }],
                },
              ],
            },
          ],
        },
      ],
    };
    const t = textOf(doc);
    expect(t).toBe("Graph A Explanation");
    expect(words(t)).toBe(3);
  });

  it("scales to large 50x10 table (500 cells) efficiently", () => {
    const rows = [];
    for (let r = 0; r < 50; r++) {
      const cells = [];
      for (let c = 0; c < 10; c++) {
        cells.push({
          type: "tableCell",
          content: [{ type: "paragraph", content: [{ type: "text", text: `cell_${r}_${c}` }] }],
        });
      }
      rows.push({ type: "tableRow", content: cells });
    }
    const doc = { type: "doc", content: [{ type: "table", content: rows }] };
    const start = performance.now();
    const t = textOf(doc);
    const duration = performance.now() - start;
    expect(words(t)).toBe(500);
    expect(duration).toBeLessThan(100);
  });
});

describe("Adversarial Suite 5: Storage Concurrency & Duplicate Project Handling", () => {
  beforeEach(() => {
    setDesktopForTesting(false);
    (globalThis as any).localStorage = createMemoryStorage();
    (globalThis as any).indexedDB = fakeIndexedDB();
    idbData.clear();
    vi.clearAllMocks();
  });

  it("handles duplicate project identity in createProjectWithAssets cleanly", async () => {
    const p = newProject("Initial Project");
    const a = await createPendingAsset(png(10, 10));

    await storage.createProjectWithAssets(p, [a]);
    const firstSaved = await storage.load(p.id);
    expect(firstSaved.title).toBe("Initial Project");

    // Attempt to create duplicate with modified title
    const pDuplicate = { ...p, title: "Malicious Overwrite" };
    await expect(storage.createProjectWithAssets(pDuplicate, [a])).rejects.toThrow(
      "A project with this identity already exists; nothing was replaced."
    );

    // Verify original project was not touched
    const stillOriginal = await storage.load(p.id);
    expect(stillOriginal.title).toBe("Initial Project");
  });

  it("guarantees atomicity when asset validation fails midway in createProjectWithAssets", async () => {
    const p = newProject("Atomic Failure Test");
    const validAsset = await createPendingAsset(png(10, 10));
    const corruptAsset = {
      id: "f".repeat(64),
      meta: { mime: "image/png" as const, byteLength: 5, width: 10, height: 10 },
      bytes: new Uint8Array([1, 2, 3, 4, 5]), // bad header & bad hash
    };

    // Staging list has valid asset first, then corrupt asset
    await expect(storage.createProjectWithAssets(p, [validAsset, corruptAsset])).rejects.toThrow();

    // The project itself MUST NOT have been created in localStorage
    await expect(storage.load(p.id)).rejects.toThrow();
  });

  it("handles multiple concurrent calls to stageAssets without corruption", async () => {
    const pId = "concurrent-proj";
    const assets = await Promise.all([
      createPendingAsset(png(10, 10)),
      createPendingAsset(png(20, 20)),
      createPendingAsset(png(30, 30)),
      createPendingAsset(png(40, 40)),
      createPendingAsset(png(50, 50)),
    ]);

    // Launch 5 concurrent stageAssets calls for different assets
    const promises = assets.map((a) => storage.stageAssets(pId, [a]));
    const results = await Promise.all(promises);
    expect(results.length).toBe(5);

    // Verify all 5 assets are stored and readable
    for (const a of assets) {
      const read = await storage.readAsset(pId, a.id);
      expect(read.bytes).toEqual(a.bytes);
    }
  });

  it("handles concurrent creation of multiple independent projects", async () => {
    const projects = [newProject("P1"), newProject("P2"), newProject("P3")];
    const asset = await createPendingAsset(png(10, 10));

    await Promise.all(projects.map((p) => storage.createProjectWithAssets(p, [asset])));

    for (const p of projects) {
      const loaded = await storage.load(p.id);
      expect(loaded.title).toBe(p.title);
      const read = await storage.readAsset(p.id, asset.id);
      expect(read.bytes).toEqual(asset.bytes);
    }
  });

  it("propagates desktop IPC create_project_with_assets error without saving", async () => {
    setDesktopForTesting(true);
    const p = newProject("Desktop Broken");
    const a = await createPendingAsset(png(10, 10));
    vi.mocked(invoke).mockRejectedValueOnce(new Error("Native SQLite disk full"));

    await expect(storage.createProjectWithAssets(p, [a])).rejects.toThrow("Native SQLite disk full");
  });
});

describe("Adversarial Suite 6: Deep Stress Vectors & Integrity Boundaries", () => {
  beforeEach(() => {
    setDesktopForTesting(false);
    (globalThis as any).localStorage = createMemoryStorage();
    (globalThis as any).indexedDB = fakeIndexedDB();
    idbData.clear();
    vi.clearAllMocks();
  });

  it("handles image node inside table cell: collectAssetIds and validation", async () => {
    const p = newProject("Table Image");
    const a = await createPendingAsset(png(10, 10));
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "image", attrs: { assetId: a.id, alt: "Cell Image" } }],
                },
              ],
            },
          ],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);

    // Validation passes
    expect(() => validateProject(p)).not.toThrow();

    // collectAssetIds finds the asset inside table cell
    const ids = collectAssetIds(p);
    expect(ids.has(a.id)).toBe(true);

    // createProjectWithAssets correctly commits it
    await storage.createProjectWithAssets(p, [a]);
    const loaded = await storage.load(p.id);
    expect(loaded.title).toBe("Table Image");
    const read = await storage.readAsset(p.id, a.id);
    expect(read.bytes).toEqual(a.bytes);
  });

  it("createProjectWithAssets fails if table cell references missing image", async () => {
    const p = newProject("Missing Table Image");
    const missingId = "b".repeat(64);
    p.entries[0].content = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [{ type: "image", attrs: { assetId: missingId, alt: "Missing Image" } }],
                },
              ],
            },
          ],
        },
      ],
    };
    p.entries[0].text = textOf(p.entries[0].content);

    await expect(storage.createProjectWithAssets(p, [])).rejects.toThrow(
      "An image in this edit is missing from the project's storage; nothing was saved. Your recovery journal has been kept."
    );
    await expect(storage.load(p.id)).rejects.toThrow();
  });

  it("handles complex unicode, RTL text, and bidirectional markers in alt text", () => {
    const complexAlt = "\u200Eمرحبا بالعالم \u200Fשלום עולם -- test! 🚀";
    const doc = {
      type: "doc",
      content: [{ type: "image", attrs: { assetId: validAssetId, alt: complexAlt } }],
    };
    const t = textOf(doc);
    expect(t).toBe(complexAlt);
    expect(words(t)).toBe(7);
  });

  it("correctly handles base64 round-trip of 1MB binary data", () => {
    const raw = new Uint8Array(1024 * 1024);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) & 255;
    const b64 = toBase64(raw);
    expect(typeof b64).toBe("string");
    expect(b64.length).toBe(Math.ceil((1024 * 1024) / 3) * 4);
  });
});
